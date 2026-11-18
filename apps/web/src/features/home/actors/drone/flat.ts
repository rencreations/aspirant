/**
 * The flat things the drone draws in pixels beside itself: the cyan trail of a fast flight under
 * it, and over it the speech bubble (an icon in a bubble) and the shock mark (radial lines and a
 * bang). One orthographic camera, one unit one CSS pixel, the origin in the middle of the screen
 * and y UP (the stage frame). The actor works in the screen frame (y down) and this file flips y
 * when it places things.
 *
 * Nothing is allocated per frame. The bubble's body is one picture drawn once in code; the icons
 * are a picture of nine cells (the six of `marks.webp` and three drawn in code beside them).
 * Everything is hidden by the actor's visibility: it is drawn only by the drone's pass.
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

import { bubbleSize, placeBubble, TIP_U, TIP_V } from "./bubble-place";
import { CYAN, MARKS } from "./model";
import { CELL, COLUMNS, iconUv, ROWS, type IconName } from "./marks";
import type { BubbleLook, ShockLook } from "./marks-anim";

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
const CYAN_CSS = "#23d0d8";

/** The bubble's picture is this many pixels square (the tail's tip is at `TIP_U`, `TIP_V` of it). */
const BUBBLE_PX = 256;
/** Where the middle of the bubble's body is in the picture, from the top (the icon sits there). */
const BODY_MID_V = 101 / BUBBLE_PX;

function makeCanvas(w: number, h: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas for the drone's marks.");
  return ctx;
}

/** A white bubble with the drone's ink line and a tail to the lower left. */
function drawBubble(): CanvasTexture {
  const ctx = makeCanvas(BUBBLE_PX, BUBBLE_PX);
  ctx.lineJoin = "round";
  ctx.lineWidth = 11;
  ctx.strokeStyle = INK_CSS;
  ctx.fillStyle = "#ffffff";
  const body = new Path2D();
  body.roundRect(14, 14, 228, 176, 66);
  const tail = new Path2D();
  tail.moveTo(52, 178);
  tail.lineTo(34, 244);
  tail.lineTo(108, 184);
  tail.closePath();
  // Both outlines first, then both fills, so the line does not cross where the tail joins.
  ctx.stroke(body);
  ctx.stroke(tail);
  ctx.fill(body);
  ctx.fill(tail);
  const texture = new CanvasTexture(ctx.canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false;
  return texture;
}

/** A shape with the drone's ink line round it: the outline first, then the colour. */
function inked(ctx: CanvasRenderingContext2D, path: Path2D, color: string, line = 14): void {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = line;
  ctx.strokeStyle = INK_CSS;
  ctx.stroke(path);
  ctx.fillStyle = color;
  ctx.fill(path);
}

/** The three icons the file does not have, drawn in a third row of its cells. */
function drawExtras(ctx: CanvasRenderingContext2D): void {
  const y = CELL * 2;
  // A pair of eighth notes joined by a beam.
  ctx.save();
  ctx.translate(0, y);
  const note = new Path2D();
  note.ellipse(58, 142, 27, 20, -0.45, 0, Math.PI * 2);
  note.moveTo(125 + 27, 128);
  note.ellipse(125, 128, 27, 20, -0.45, 0, Math.PI * 2);
  note.moveTo(72, 138);
  note.rect(72, 46, 14, 96);
  note.rect(139, 34, 14, 96);
  note.moveTo(72, 46);
  note.lineTo(153, 34);
  note.lineTo(153, 66);
  note.lineTo(72, 78);
  note.closePath();
  inked(ctx, note, CYAN_CSS, 14);
  ctx.restore();
  // Three dots.
  ctx.save();
  ctx.translate(CELL, y);
  ctx.fillStyle = INK_CSS;
  for (const cx of [46, 96, 146]) {
    ctx.beginPath();
    ctx.arc(cx, 100, 17, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // A drop of sweat.
  ctx.save();
  ctx.translate(CELL * 2, y);
  const drop = new Path2D();
  drop.moveTo(96, 28);
  drop.bezierCurveTo(112, 70, 148, 98, 148, 128);
  drop.bezierCurveTo(148, 160, 124, 172, 96, 172);
  drop.bezierCurveTo(68, 172, 44, 160, 44, 128);
  drop.bezierCurveTo(44, 98, 80, 70, 96, 28);
  drop.closePath();
  inked(ctx, drop, CYAN_CSS, 12);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.ellipse(76, 128, 8, 16, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The nine icons as one picture: the file's six on top, the three drawn in code under them. */
async function loadIcons(): Promise<CanvasTexture> {
  const url = await loadMedia(MARKS, { type: "image/webp" });
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
  const ctx = makeCanvas(CELL * COLUMNS, CELL * ROWS);
  ctx.drawImage(image, 0, 0);
  drawExtras(ctx);
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

/** Set a quad's four uv corners to a cell of the icon picture. */
function setUv(geometry: PlaneGeometry, icon: IconName): void {
  const r = iconUv(icon, { u: 0, v: 0, du: 0, dv: 0 });
  const uv = geometry.getAttribute("uv");
  // PlaneGeometry's corners: top left, top right, bottom left, bottom right.
  uv.setXY(0, r.u, r.v);
  uv.setXY(1, r.u + r.du, r.v);
  uv.setXY(2, r.u, r.v + r.dv);
  uv.setXY(3, r.u + r.du, r.v + r.dv);
  uv.needsUpdate = true;
}

export class FlatLayer {
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, -10, 10);
  /** Drawn before the drone. */
  readonly under = new Scene();
  /** Drawn after it. */
  readonly over = new Scene();

  private readonly trail = makeTrail();
  private readonly bubbleGroup = new Group();
  private readonly bubbleMesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly iconMesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly shockGroup = new Group();
  private readonly linesInk: Mesh<BufferGeometry, MeshBasicMaterial>;
  private readonly linesGold: Mesh<BufferGeometry, MeshBasicMaterial>;
  private readonly bangMesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly bubbleTexture: CanvasTexture;
  private readonly textures: Texture[];
  private shownIcon: IconName | null = null;
  private width = 1;
  private height = 1;
  private readonly bubble = { side: 1, x: 0, y: 0 };

  static async load(): Promise<FlatLayer> {
    return new FlatLayer(await loadIcons());
  }

  private constructor(icons: CanvasTexture) {
    this.bubbleTexture = drawBubble();
    this.textures = [this.bubbleTexture, icons];
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
    this.bubbleMesh = quad(this.bubbleTexture, 1);
    this.iconMesh = quad(icons, 2);
    // The bubble's plane is drawn with its uv as laid: the picture is not flipped, v runs down.
    setUv(this.bubbleMesh.geometry, "heart");
    const whole = this.bubbleMesh.geometry.getAttribute("uv");
    whole.setXY(0, 0, 0);
    whole.setXY(1, 1, 0);
    whole.setXY(2, 0, 1);
    whole.setXY(3, 1, 1);
    this.bubbleGroup.add(this.bubbleMesh, this.iconMesh);
    this.bubbleGroup.visible = false;

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
    this.bangMesh = quad(icons, 5);
    setUv(this.bangMesh.geometry, "bang");
    this.shockGroup.add(this.linesInk, this.linesGold, this.bangMesh);
    this.shockGroup.visible = false;
    this.over.add(this.bubbleGroup, this.shockGroup);
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

  /**
   * Show the bubble for a drone whose middle is (`x`, `y`) in the screen frame and whose body is
   * `height` pixels tall. `look` is the animation (`marks-anim.ts`). Hidden when `look.alpha` is 0.
   */
  setBubble(icon: IconName | null, look: BubbleLook, x: number, y: number, height: number): void {
    if (!icon || look.alpha <= 0.002 || look.scale <= 0.002) {
      this.bubbleGroup.visible = false;
      return;
    }
    this.bubbleGroup.visible = true;
    if (icon !== this.shownIcon) {
      this.shownIcon = icon;
      setUv(this.iconMesh.geometry, icon);
    }
    const size = bubbleSize(height);
    const at = placeBubble(
      x,
      -y,
      height,
      look.lift,
      this.bubble.side,
      this.width,
      this.height,
      this.bubble,
    );
    const side = at.side;

    const g = this.bubbleGroup;
    g.position.set(at.x, at.y, 0);
    g.rotation.z = look.rot * side;
    g.scale.setScalar(look.scale);
    // The bubble's own plane is mirrored for the left; the icon is never mirrored.
    this.bubbleMesh.scale.set(size * side, size, 1);
    this.bubbleMesh.position.set((0.5 - TIP_U) * size * side, (TIP_V - 0.5) * size, 0);
    const icon01 = 0.58 * size;
    this.iconMesh.scale.set(icon01, icon01, 1);
    this.iconMesh.position.set((0.5 - TIP_U) * size * side, (TIP_V - BODY_MID_V) * size, 0);
    this.bubbleMesh.material.opacity = look.alpha;
    this.iconMesh.material.opacity = look.alpha;
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
    return this.bubbleGroup.visible || this.shockGroup.visible;
  }

  warm(renderer: { initTexture: (t: Texture) => void }): void {
    for (const t of this.textures) renderer.initTexture(t);
  }

  dispose(): void {
    this.trail.mesh.geometry.dispose();
    this.trail.mesh.material.dispose();
    for (const mesh of [this.bubbleMesh, this.iconMesh, this.bangMesh]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    for (const mesh of [this.linesInk, this.linesGold]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    for (const t of this.textures) t.dispose();
    this.under.clear();
    this.over.clear();
  }
}
