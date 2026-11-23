/**
 * The kite drawn: the sail (her own chibi picture on a cloth plane that ripples in the wind), the
 * spine behind it, the rope as a smooth ribbon and the tail of three bows. It lives in the stage's
 * pixel frame (an orthographic camera: one unit is one CSS pixel, the origin is the middle of the
 * screen, y up). Two scenes: the sail, the spine and the tail are drawn behind Tetra (`scene`); the
 * rope is drawn in front of her (`ropes`), so it runs from the reel in her hands. The simulation is
 * `kite-sim.ts`; this only lays it on meshes. Unlit, like her.
 */
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  type OrthographicCamera,
  type Texture,
  type WebGLRenderer,
} from "three";

import { loadMedia } from "@/lib/media-store";

import { KITE, KITE_BOWS, KITE_BOW_CELLS } from "../model";

import { ROPE_POINTS, type KiteSim } from "./kite-sim";
import { type Chain, smoothChain } from "./rope";

const INK = 0x2a3342;
/** How wide the rope is drawn, in CSS pixels. */
const ROPE_WIDTH = 2.2;
const SUB = 4;
const BOW_COLORS = 3;
/** The bows sit on these points of the tail, and are this wide next to the sail's width. */
const BOW_AT = [2, 4, 6] as const;
const BOW_WIDTH = 0.2;

async function loadTexture(path: string): Promise<Texture | null> {
  try {
    const url = await loadMedia(path, { type: "image/webp" });
    const texture = await new TextureLoader().loadAsync(url);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  } catch (error) {
    console.warn(`[tetra] ${path} did not load: the kite is not drawn`, error);
    return null;
  }
}

/** A ribbon of constant width along a smoothed line: a triangle strip written each frame. */
class Ribbon {
  readonly mesh: Mesh;
  private readonly geometry = new BufferGeometry();
  private readonly positions: Float32Array;
  private readonly line: Float32Array;

  constructor(
    capacity: number,
    material: MeshBasicMaterial,
    private readonly width: number,
  ) {
    this.positions = new Float32Array(capacity * 2 * 3);
    this.line = new Float32Array(capacity * 2);
    this.geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    const index: number[] = [];
    for (let i = 0; i < capacity - 1; i += 1) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geometry.setIndex(index);
    this.mesh = new Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.visible = false;
  }

  /** Lay the chain's smoothed line as a strip. Returns false when there is no line to draw. */
  set(chain: Chain, taper = 0): boolean {
    const count = smoothChain(chain, SUB, this.line);
    if (count < 2) {
      this.mesh.visible = false;
      return false;
    }
    const half = this.width / 2;
    const l = this.line;
    for (let i = 0; i < count; i += 1) {
      const a = Math.max(0, i - 1);
      const b = Math.min(count - 1, i + 1);
      let dx = (l[b * 2] ?? 0) - (l[a * 2] ?? 0);
      let dy = (l[b * 2 + 1] ?? 0) - (l[a * 2 + 1] ?? 0);
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      const w = half * (1 - taper * (i / (count - 1)));
      const x = l[i * 2] ?? 0;
      const y = l[i * 2 + 1] ?? 0;
      const o = i * 6;
      this.positions[o] = x - dy * w;
      this.positions[o + 1] = y + dx * w;
      this.positions[o + 2] = 0;
      this.positions[o + 3] = x + dy * w;
      this.positions[o + 4] = y - dx * w;
      this.positions[o + 5] = 0;
    }
    // The rest of the strip collapses onto the last point.
    const last = (count - 1) * 6;
    for (let i = count; i * 6 < this.positions.length; i += 1) {
      this.positions.copyWithin(i * 6, last, last + 6);
    }
    (this.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
    this.mesh.visible = true;
    return true;
  }

  hide(): void {
    this.mesh.visible = false;
  }

  dispose(): void {
    this.geometry.dispose();
  }
}

export class KiteLayer {
  /** The sail, its tail and the spine: drawn behind her. */
  readonly scene = new Scene();
  /** The rope: drawn in front of her, so it runs from the reel and not from behind her sleeve. */
  readonly ropes = new Scene();
  private readonly sail: Mesh;
  private readonly spine: Mesh;
  private readonly ropeMat = new MeshBasicMaterial({ color: INK, toneMapped: false });
  private readonly rope: Ribbon;
  private readonly lower: Ribbon;
  private readonly upper: Ribbon;
  private readonly tail: Ribbon;
  private readonly bows: Mesh[] = [];
  private readonly uniforms = { uTime: { value: 0 }, uAmp: { value: 1 } };
  private readonly textures: Texture[] = [];
  private readonly sailGeo = new PlaneGeometry(1, 1, 6, 8);
  private readonly bowGeo: BufferGeometry[] = [];
  private readonly spineMat = new MeshBasicMaterial({ color: INK, toneMapped: false });
  private readonly materials: MeshBasicMaterial[] = [];
  private shown = false;

  /** Load the sail and the bows. A picture that did not arrive leaves the kite undrawn. */
  static async load(): Promise<KiteLayer | null> {
    const [sail, bows] = await Promise.all([loadTexture(KITE), loadTexture(KITE_BOWS)]);
    if (!sail) return null;
    return new KiteLayer(sail, bows);
  }

  private constructor(sail: Texture, bows: Texture | null) {
    const u = this.uniforms;
    const sailMat = new MeshBasicMaterial({
      map: sail,
      transparent: true,
      side: DoubleSide,
      toneMapped: false,
      depthWrite: false,
    });
    sailMat.customProgramCacheKey = () => "home-tetra-sail";
    sailMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = u.uTime;
      shader.uniforms.uAmp = u.uAmp;
      // The cloth ripples from the knot outward: nothing at the tie, the most at the foot and the
      // edges. The plane is one unit, so the offsets are in parts of the sail.
      shader.vertexShader =
        "uniform float uTime;\nuniform float uAmp;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          [
            "vec3 transformed = position;",
            "float down = clamp(0.48 - uv.y, 0.0, 1.0) + clamp(uv.y - 0.48, 0.0, 1.0) * 0.4;",
            "float edge = abs(uv.x - 0.5) * 2.0;",
            "float w = sin(uTime * 4.1 + uv.y * 7.0) * 0.55 + sin(uTime * 7.3 + uv.y * 3.0 + uv.x * 2.0) * 0.45;",
            "transformed.x += uAmp * 0.035 * w * down * (0.35 + edge);",
            "transformed.y += uAmp * 0.012 * sin(uTime * 5.2 + uv.x * 5.0) * down * edge;",
          ].join("\n"),
        );
    };
    sailMat.needsUpdate = true;
    this.materials.push(sailMat, this.ropeMat, this.spineMat);
    this.textures.push(sail);

    this.sail = new Mesh(this.sailGeo, sailMat);
    this.sail.renderOrder = 2;
    this.sail.frustumCulled = false;
    this.spine = new Mesh(new PlaneGeometry(1, 1), this.spineMat);
    this.spine.renderOrder = 1;
    this.spine.frustumCulled = false;
    this.scene.add(this.spine, this.sail);

    const rope = (n: number) => new Ribbon(n, this.ropeMat, ROPE_WIDTH);
    this.rope = rope(ROPE_POINTS * SUB + 1);
    this.lower = rope(ROPE_POINTS * SUB + 1);
    this.upper = rope(ROPE_POINTS * SUB + 1);
    this.tail = new Ribbon(8 * SUB + 1, this.ropeMat, 1.4);
    this.ropes.add(this.rope.mesh, this.lower.mesh, this.upper.mesh);
    this.scene.add(this.tail.mesh);

    if (bows) {
      this.textures.push(bows);
      for (let i = 0; i < BOW_AT.length; i += 1) {
        const mat = new MeshBasicMaterial({
          map: bows.clone(),
          transparent: true,
          toneMapped: false,
          depthWrite: false,
          side: DoubleSide,
        });
        const map = mat.map;
        if (map) {
          map.colorSpace = SRGBColorSpace;
          map.repeat.set(1 / KITE_BOW_CELLS, 1);
          map.offset.set((i % BOW_COLORS) / KITE_BOW_CELLS, 0);
          map.needsUpdate = true;
          this.textures.push(map);
        }
        this.materials.push(mat);
        const geo = new PlaneGeometry(1, 0.75);
        this.bowGeo.push(geo);
        const bow = new Mesh(geo, mat);
        bow.renderOrder = 3;
        bow.frustumCulled = false;
        this.bows.push(bow);
        this.scene.add(bow);
      }
    }
    this.hide();
  }

  hide(): void {
    this.shown = false;
    for (const child of this.scene.children) child.visible = false;
    for (const child of this.ropes.children) child.visible = false;
  }

  /** Warm the shaders and the pictures. */
  warm(renderer: WebGLRenderer, camera: OrthographicCamera): void {
    const before = this.scene.children.map((c) => c.visible);
    for (const child of this.scene.children) child.visible = true;
    renderer.compile(this.scene, camera);
    this.scene.children.forEach((c, i) => {
      c.visible = before[i] ?? false;
    });
    renderer.compile(this.ropes, camera);
    for (const t of this.textures) renderer.initTexture(t);
  }

  get visible(): boolean {
    return this.shown;
  }

  /** Lay the simulation on the meshes. */
  update(sim: KiteSim, time: number, flutter: number): void {
    this.shown = true;
    const look = sim.look;
    this.uniforms.uTime.value = time;
    this.uniforms.uAmp.value = flutter;
    this.sail.visible = true;
    this.sail.position.set(look.x, look.y, 0);
    this.sail.rotation.z = look.roll;
    this.sail.scale.set(look.width, look.height, 1);
    // The spine runs a little past both ends of the sail and shows between the ears and the feet.
    this.spine.visible = true;
    this.spine.position.set(look.x, look.y, 0);
    this.spine.rotation.z = look.roll;
    this.spine.scale.set(Math.max(1.6, look.width * 0.012), look.height * 1.06, 1);

    if (sim.state === "tethered") {
      this.rope.set(sim.rope);
      this.lower.hide();
      this.upper.hide();
    } else {
      this.rope.hide();
      this.lower.set(sim.lower);
      this.upper.set(sim.upper);
    }
    this.tail.set(sim.tail, 0.5);
    // The bows sit on the tail, turned along it, a little bigger near the sail.
    const t = sim.tail;
    for (let i = 0; i < this.bows.length; i += 1) {
      const bow = this.bows[i];
      const at = BOW_AT[i];
      if (!bow || at === undefined || at >= t.n) continue;
      const x = t.x[at] ?? 0;
      const y = t.y[at] ?? 0;
      const dx = (t.x[at - 1] ?? x) - x;
      const dy = (t.y[at - 1] ?? y) - y;
      bow.visible = true;
      bow.position.set(x, y, 0);
      bow.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
      const s = look.width * BOW_WIDTH * (1.1 - 0.12 * i);
      bow.scale.set(s, s, 1);
    }
  }

  dispose(): void {
    for (const r of [this.rope, this.lower, this.upper, this.tail]) r.dispose();
    this.sailGeo.dispose();
    this.spine.geometry.dispose();
    for (const g of this.bowGeo) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.scene.clear();
    this.ropes.clear();
  }
}
