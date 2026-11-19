/**
 * The backdrop's own WebGL context: a small canvas in the ground stack, drawn with a fullscreen
 * triangle per layer. It is not the stage's canvas (that one is above the `below` layer and would
 * cover it), so the home has two contexts: the stage and this one. It makes no draw call while
 * nothing is shown, and a lost context is rebuilt the way the stage does it (wait, then a new canvas),
 * and given up quietly after a few tries: a missing backdrop is a plainer page, never a failed one.
 */
import {
  AddEquation,
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  Mesh,
  OneFactor,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
  ZeroFactor,
} from "three";

import { fragmentFor, VERTEX } from "./glsl-prelude";
import type { Params } from "./params";
import type { BackdropKind } from "./palettes";
import { KIND_DEFS } from "./registry";

/** How long a lost context may take to come back before a new canvas is made. */
const RESTORE_WAIT_MS = 1500;
const REBUILDS = 3;

/** One layer of a draw: a kind, its weight, its own time and numbers. */
export interface LayerDraw {
  kind: BackdropKind;
  weight: number;
  time: number;
  params: Params;
}

/** What every layer of a frame shares. */
export interface FrameFeed {
  /** The pointer, 0..1 from the left and from the bottom. */
  pointerX: number;
  pointerY: number;
  /** 0 when there is no pointer to follow, 1 when there is. */
  pointerOn: number;
  /** The home's scroll position in screens. */
  S: number;
  /** The smoothed speed of the scroll, screens a second, absolute. */
  vel: number;
  /** The ripples the pointer left (`trail.ts`): x, y, age and strength for each of ten. */
  trail: Float32Array;
}

type UniformSet = {
  uTime: { value: number };
  uRes: { value: Vector2 };
  uCss: { value: Vector2 };
  uAsp: { value: number };
  uPx: { value: number };
  uPointer: { value: Vector3 };
  uS: { value: number };
  uVel: { value: number };
  uAmount: { value: number };
  uIntensity: { value: number };
  uScale: { value: number };
  uAngle: { value: number };
  uSeed: { value: number };
  uWeight: { value: number };
  uC0: { value: Vector3 };
  uC1: { value: Vector3 };
  uC2: { value: Vector3 };
  uC3: { value: Vector3 };
  uInk: { value: Vector3 };
  uTrail: { value: Float32Array };
  uX: { value: Vector4 };
};

function makeUniforms(): UniformSet {
  return {
    uTime: { value: 0 },
    uRes: { value: new Vector2(2, 2) },
    uCss: { value: new Vector2(2, 2) },
    uAsp: { value: 1 },
    uPx: { value: 1 },
    uPointer: { value: new Vector3(0.5, 0.5, 0) },
    uS: { value: 0 },
    uVel: { value: 0 },
    uAmount: { value: 1 },
    uIntensity: { value: 1 },
    uScale: { value: 1 },
    uAngle: { value: 0 },
    uSeed: { value: 0 },
    uWeight: { value: 1 },
    uC0: { value: new Vector3() },
    uC1: { value: new Vector3() },
    uC2: { value: new Vector3() },
    uC3: { value: new Vector3() },
    uInk: { value: new Vector3(1, 1, 1) },
    uTrail: { value: new Float32Array(40) },
    uX: { value: new Vector4() },
  };
}

export interface GLHooks {
  /** The context is gone for good: the backdrop is not drawn any more (the page goes on). */
  onGone(): void;
}

export class BackdropGL {
  canvas: HTMLCanvasElement;
  renderer: WebGLRenderer;
  /** Buffer size in pixels. */
  bufferW = 2;
  bufferH = 2;
  lost = false;
  gone = false;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly geometry = new BufferGeometry();
  private readonly mesh: Mesh;
  private readonly materials = new Map<BackdropKind, { material: ShaderMaterial; u: UniformSet }>();
  private restoreTimer = 0;
  private rebuilds = 0;
  private disposed = false;
  private shown = true;
  private cssW = 2;
  private cssH = 2;

  constructor(
    private readonly host: HTMLElement,
    private readonly hooks: GLHooks,
  ) {
    this.geometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    this.mesh = new Mesh(this.geometry);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.scene.add(this.mesh);
    const made = this.makeRenderer();
    this.canvas = made.canvas;
    this.renderer = made.renderer;
  }

  /** The GPU the context runs on, for the cost table. */
  gpuName(): string {
    const gl = this.renderer.getContext();
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "unknown";
  }

  /** Make the drawing buffer `w` by `h` pixels for a canvas of `cssW` by `cssH` CSS pixels. */
  resize(w: number, h: number, cssW: number, cssH: number): void {
    if (this.disposed || this.lost) return;
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    if (w === this.bufferW && h === this.bufferH) return;
    this.bufferW = w;
    this.bufferH = h;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
  }

  /** The canvas is only in the page's paint while something is drawn. */
  setShown(on: boolean): void {
    if (on === this.shown) return;
    this.shown = on;
    this.canvas.style.visibility = on ? "visible" : "hidden";
  }

  /** Draw the layers (the first replaces the canvas, the rest add: a linear cross-fade). */
  draw(layers: readonly LayerDraw[], count: number, feed: FrameFeed): number {
    if (this.disposed || this.lost || this.gone || count === 0) return 0;
    for (let i = 0; i < count; i++) {
      const layer = layers[i]!;
      const { material, u } = this.entry(layer.kind);
      const p = layer.params;
      u.uTime.value = layer.time;
      u.uRes.value.set(this.bufferW, this.bufferH);
      u.uCss.value.set(this.cssW, this.cssH);
      u.uAsp.value = this.cssW / this.cssH;
      u.uPx.value = this.bufferH / this.cssH;
      u.uPointer.value.set(feed.pointerX, feed.pointerY, feed.pointerOn);
      u.uS.value = feed.S;
      u.uVel.value = feed.vel;
      u.uAmount.value = p.amount;
      u.uIntensity.value = p.intensity;
      u.uScale.value = p.scale;
      u.uAngle.value = p.angle;
      u.uSeed.value = p.seed;
      u.uWeight.value = layer.weight;
      u.uC0.value.set(p.stops[0]!, p.stops[1]!, p.stops[2]);
      u.uC1.value.set(p.stops[3]!, p.stops[4]!, p.stops[5]);
      u.uC2.value.set(p.stops[6]!, p.stops[7]!, p.stops[8]);
      u.uC3.value.set(p.stops[9]!, p.stops[10]!, p.stops[11]);
      u.uInk.value.set(p.ink[0]!, p.ink[1]!, p.ink[2]);
      u.uTrail.value = feed.trail;
      u.uX.value.set(p.extras[0]!, p.extras[1]!, p.extras[2]!, p.extras[3]!);
      // The first layer replaces the canvas, the others add to it: in premultiplied colour that is
      // `old * (1 - t) + new * t`, a true linear cross-fade (no dip where the ground shows through).
      material.blendDst = i === 0 ? ZeroFactor : OneFactor;
      material.blendDstAlpha = material.blendDst;
      material.uniformsNeedUpdate = true;
      this.mesh.material = material;
      this.renderer.render(this.scene, this.camera);
    }
    return count;
  }

  /**
   * Compile the programs of some kinds ahead of their first draw, without blocking when the browser
   * can compile in parallel. A section calls this in `mount`, so the first frame of a kind is not a
   * hitch.
   */
  async warm(kinds: readonly BackdropKind[]): Promise<void> {
    for (const kind of kinds) {
      if (this.disposed || this.lost || this.gone) return;
      this.mesh.material = this.entry(kind).material;
      try {
        await this.renderer.compileAsync(this.scene, this.camera);
      } catch {
        /* a program that does not compile shows when it is drawn, with the driver's message */
      }
    }
  }

  /** Free the GPU and take the canvas out. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.clearTimeout(this.restoreTimer);
    this.detach(this.canvas);
    this.release();
    this.geometry.dispose();
  }

  private entry(kind: BackdropKind): { material: ShaderMaterial; u: UniformSet } {
    let have = this.materials.get(kind);
    if (!have) {
      const u = makeUniforms();
      const material = new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: fragmentFor(KIND_DEFS[kind].frag),
        uniforms: u,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        blending: CustomBlending,
        blendEquation: AddEquation,
        blendSrc: OneFactor,
        blendDst: ZeroFactor,
        blendSrcAlpha: OneFactor,
        blendDstAlpha: ZeroFactor,
      });
      have = { material, u };
      this.materials.set(kind, have);
    }
    return have;
  }

  private makeRenderer(): { canvas: HTMLCanvasElement; renderer: WebGLRenderer } {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.homeBackdrop = "";
    const renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0);
    this.host.appendChild(canvas);
    canvas.addEventListener("webglcontextlost", this.onLost);
    canvas.addEventListener("webglcontextrestored", this.onRestored);
    return { canvas, renderer };
  }

  private detach(canvas: HTMLCanvasElement): void {
    canvas.removeEventListener("webglcontextlost", this.onLost);
    canvas.removeEventListener("webglcontextrestored", this.onRestored);
  }

  private release(): void {
    for (const { material } of this.materials.values()) material.dispose();
    this.materials.clear();
    this.renderer.dispose();
    if (!this.lost) this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  private readonly onLost = (event: Event): void => {
    event.preventDefault();
    this.lost = true;
    window.clearTimeout(this.restoreTimer);
    this.restoreTimer = window.setTimeout(() => {
      this.rebuild();
    }, RESTORE_WAIT_MS);
  };

  private readonly onRestored = (): void => {
    window.clearTimeout(this.restoreTimer);
    this.lost = false;
    // The buffer is the browser's to reset on a restore: set it again at the next draw.
    this.bufferW = 0;
    this.bufferH = 0;
  };

  /** The context did not come back: a new canvas and renderer, the same kinds. */
  private rebuild(): void {
    if (this.disposed) return;
    this.rebuilds += 1;
    if (this.rebuilds > REBUILDS) {
      this.gone = true;
      this.canvas.style.visibility = "hidden";
      this.hooks.onGone();
      return;
    }
    this.detach(this.canvas);
    this.release();
    try {
      const made = this.makeRenderer();
      this.canvas = made.canvas;
      this.renderer = made.renderer;
    } catch {
      this.gone = true;
      this.hooks.onGone();
      return;
    }
    this.lost = false;
    this.bufferW = 0;
    this.bufferH = 0;
    this.shown = true;
  }
}
