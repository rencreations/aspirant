/**
 * The flat things the drone draws in pixels beside itself: the cyan trail of a fast flight under
 * it, and over it the shock mark (radial lines and a bang). The drone has no speech bubbles (the
 * owner's call, 19 Nov 2026). One orthographic camera, one unit one CSS pixel, the origin in the
 * middle of the screen and y UP (the stage frame). The actor works in the screen frame (y down)
 * and this file flips y when it places things.
 *
 * Nothing is allocated per frame. The bang is one cell of `marks.webp`. Everything is hidden by the
 * actor's visibility: it is drawn only by the drone's pass.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  type Texture,
} from "three";

import { loadMedia } from "@/lib/media-store";

import { CYAN, MARKS } from "./model";
import { BANG_CELL, CELL } from "./marks";
import type { ShockLook } from "./marks-anim";

/** The most points a trail is drawn from. */
export const TRAIL_POINTS = 24;

/** A place the drone was at, in the screen frame, and how old it is (0 now, 1 as old as a trail gets). */
export interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

const GOLD = "#f2b01e";
const INK_CSS = "#1f2735";

function makeCanvas(w: number, h: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas for the drone's marks.");
  return ctx;
}

/** The bang: one cell of the icon file, drawn on a small canvas of its own. */
async function loadBang(): Promise<CanvasTexture> {
  const url = await loadMedia(MARKS, { type: "image/webp" });
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
  const ctx = makeCanvas(CELL, CELL);
  ctx.drawImage(image, BANG_CELL.col * CELL, BANG_CELL.row * CELL, CELL, CELL, 0, 0, CELL, CELL);
  const texture = new CanvasTexture(ctx.canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false;
  return texture;
}

/** The ribbon behind the drone: three corners across for every place it has been. */
function makeTrail(): {
  mesh: Mesh<BufferGeometry, ShaderMaterial>;
  position: BufferAttribute;
  alpha: BufferAttribute;
} {
  const geometry = new BufferGeometry();
  const position = new BufferAttribute(new Float32Array(TRAIL_POINTS * 3 * 3), 3);
  const alpha = new BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 1);
  position.setUsage(DynamicDrawUsage);
  alpha.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", position);
  geometry.setAttribute("aAlpha", alpha);
  const index: number[] = [];
  for (let i = 0; i < TRAIL_POINTS - 1; i += 1) {
    const a = i * 3;
    index.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
  }
  geometry.setIndex(index);
  geometry.setDrawRange(0, 0);
  const material = new ShaderMaterial({
    uniforms: { uColor: { value: new Color(CYAN) } },
    vertexShader: [
      "attribute float aAlpha;",
      "varying float vAlpha;",
      "void main() {",
      "  vAlpha = aAlpha;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}",
    ].join("\n"),
    fragmentShader: [
      "uniform vec3 uColor;",
      "varying float vAlpha;",
      "void main() {",
      "  gl_FragColor = vec4(uColor, vAlpha);",
      "  #include <colorspace_fragment>",
      "}",
    ].join("\n"),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  return { mesh, position, alpha };
}

/** The shock lines: eight tapered strokes round a middle, in a unit that is the circle they start on. */
function makeLines(grow: number): BufferGeometry {
  const count = 8;
  const verts = new Float32Array(count * 3 * 3);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + Math.PI / 8;
    const long = i % 2 === 0;
    const inner = 1 - 0.04 * grow;
    const outer = (long ? 1.85 : 1.55) + 0.1 * grow;
    const wide = 0.2 + 0.1 * grow;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const base = i * 9;
    // A thin triangle: wide at the inner end, a point at the outer end.
    verts.set([c * inner - s * wide, s * inner + c * wide, 0], base);
    verts.set([c * inner + s * wide, s * inner - c * wide, 0], base + 3);
    verts.set([c * outer, s * outer, 0], base + 6);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(verts, 3));
  return geometry;
}

export class FlatLayer {
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, -10, 10);
  /** Drawn before the drone. */
  readonly under = new Scene();
  /** Drawn after it. */
  readonly over = new Scene();

  private readonly trail = makeTrail();
  private readonly shockGroup = new Group();
  private readonly linesInk: Mesh<BufferGeometry, MeshBasicMaterial>;
  private readonly linesGold: Mesh<BufferGeometry, MeshBasicMaterial>;
  private readonly bangMesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly textures: Texture[];
  private width = 1;
  private height = 1;

  static async load(): Promise<FlatLayer> {
    return new FlatLayer(await loadBang());
  }

  private constructor(bang: CanvasTexture) {
    this.textures = [bang];
    this.under.add(this.trail.mesh);

    const quad = (map: Texture, order: number) => {
      const mesh = new Mesh(
        new PlaneGeometry(1, 1),
        new MeshBasicMaterial({
          map,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      mesh.renderOrder = order;
      mesh.frustumCulled = false;
      return mesh;
    };
    const flat = (color: string, order: number, grow: number) => {
      const mesh = new Mesh(
        makeLines(grow),
        new MeshBasicMaterial({
          color: new Color(color),
          transparent: true,
          depthTest: false,
          depthWrite: false,
          side: DoubleSide,
          toneMapped: false,
        }),
      );
      mesh.renderOrder = order;
      mesh.frustumCulled = false;
      return mesh;
    };
    this.linesInk = flat(INK_CSS, 3, 1);
    this.linesGold = flat(GOLD, 4, 0);
    this.bangMesh = quad(bang, 5);
    this.shockGroup.add(this.linesInk, this.linesGold, this.bangMesh);
    this.shockGroup.visible = false;
    this.over.add(this.shockGroup);
  }

  resize(w: number, h: number): void {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.camera.left = -this.width / 2;
    this.camera.right = this.width / 2;
    this.camera.top = this.height / 2;
    this.camera.bottom = -this.height / 2;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Lay the trail out as a ribbon: as wide as `width` where the drone is (the drone itself covers
   * that end), narrowing to nothing at its old end, and fading both along its length and toward its
   * two edges, so it is a soft streak with no hard side. Points are in the screen frame (y down).
   */
  setTrail(pts: readonly TrailPoint[], count: number, strength: number, width: number): void {
    const n = Math.min(count, TRAIL_POINTS);
    const { mesh, position, alpha } = this.trail;
    if (n < 3 || strength <= 0.01) {
      mesh.geometry.setDrawRange(0, 0);
      return;
    }
    for (let i = 0; i < n; i += 1) {
      const p = pts[i];
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      if (!p || !a || !b) continue;
      // The normal of the line, in the flat (y up) frame.
      let nx = b.y - a.y;
      let ny = b.x - a.x;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      const left = 1 - Math.min(1, Math.max(0, p.age));
      const half = width * 0.5 * Math.pow(left, 0.8);
      const px = p.x;
      const py = -p.y;
      position.setXYZ(i * 3, px + nx * half, py + ny * half, 0);
      position.setXYZ(i * 3 + 1, px, py, 0);
      position.setXYZ(i * 3 + 2, px - nx * half, py - ny * half, 0);
      alpha.setX(i * 3, 0);
      alpha.setX(i * 3 + 1, strength * left * left);
      alpha.setX(i * 3 + 2, 0);
    }
    position.needsUpdate = true;
    alpha.needsUpdate = true;
    mesh.geometry.setDrawRange(0, (n - 1) * 12);
  }

  get hasTrail(): boolean {
    return this.trail.mesh.geometry.drawRange.count > 0;
  }

  /** Show the shock mark above a drone at (`x`, `y`), `height` tall. */
  setShock(look: ShockLook, x: number, y: number, height: number): void {
    if (look.bangAlpha <= 0.002 && look.lineAlpha <= 0.002) {
      this.shockGroup.visible = false;
      return;
    }
    this.shockGroup.visible = true;
    const g = this.shockGroup;
    g.position.set(x, -y + 0.64 * height, 0);
    const bang = Math.max(36, height * 0.46);
    this.bangMesh.scale.setScalar(bang * look.bang);
    this.bangMesh.rotation.z = look.bangRot;
    this.bangMesh.material.opacity = look.bangAlpha;
    const ring = bang * 0.5 * (0.7 + 0.35 * look.burst);
    this.linesInk.scale.setScalar(ring);
    this.linesGold.scale.setScalar(ring);
    this.linesInk.material.opacity = look.lineAlpha;
    this.linesGold.material.opacity = look.lineAlpha;
  }

  /** True when the over scene has something to draw. */
  get hasMarks(): boolean {
    return this.shockGroup.visible;
  }

  warm(renderer: { initTexture: (t: Texture) => void }): void {
    for (const t of this.textures) renderer.initTexture(t);
  }

  dispose(): void {
    this.trail.mesh.geometry.dispose();
    this.trail.mesh.material.dispose();
    for (const mesh of [this.bangMesh, this.linesInk, this.linesGold]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    for (const t of this.textures) t.dispose();
    this.under.clear();
    this.over.clear();
  }
}
