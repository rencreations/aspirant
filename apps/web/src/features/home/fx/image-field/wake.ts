/**
 * The wake as a GPU thing: two half-float targets of 160 texels on the long side that the cursor
 * stirs (shader and numbers in `shaders.ts` and `wake-math.ts`). One fragment pass a frame while
 * it is live, and nothing at all after it has gone quiet. Where half-float targets cannot be
 * drawn to, the wake is off and the field has no wave (the rest still works).
 */
import {
  ClampToEdgeWrapping,
  HalfFloatType,
  LinearFilter,
  RGBAFormat,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from "three";

import { FullscreenPass } from "./post";
import { FULLSCREEN_VERTEX, WAKE_FRAGMENT } from "./shaders";
import { stirRadius, wakeIsLive, wakeSize } from "./wake-math";

function makeTarget(w: number, h: number): WebGLRenderTarget {
  const target = new WebGLRenderTarget(w, h, {
    type: HalfFloatType,
    format: RGBAFormat,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  return target;
}

/** A stroke of the pointer in CSS pixels from the bottom left, with the force it stirs with (px/s). */
export interface Stir {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  forceX: number;
  forceY: number;
}

export class WakeField {
  private a: WebGLRenderTarget;
  private b: WebGLRenderTarget;
  private readonly pass: FullscreenPass;
  private readonly u = {
    tFlow: { value: null as Texture | null },
    uTexel: { value: new Vector2(1, 1) },
    uFrame: { value: new Vector2(1, 1) },
    uDt: { value: 0 },
    uFrom: { value: new Vector2() },
    uTo: { value: new Vector2() },
    uForce: { value: new Vector2() },
    uRadius: { value: 45 },
    uStir: { value: 0 },
  };
  private lastStir = -Infinity;
  private dirty = false;

  constructor(cssW: number, cssH: number) {
    const size = wakeSize(cssW, cssH);
    this.a = makeTarget(size.w, size.h);
    this.b = makeTarget(size.w, size.h);
    const material = new ShaderMaterial({
      uniforms: this.u,
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: WAKE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    material.toneMapped = false;
    this.pass = new FullscreenPass(material);
    this.resize(cssW, cssH);
  }

  /** Whether this renderer can draw to a half-float target. */
  static supported(renderer: WebGLRenderer): boolean {
    return (
      renderer.extensions.has("EXT_color_buffer_float") ||
      renderer.extensions.has("EXT_color_buffer_half_float")
    );
  }

  resize(cssW: number, cssH: number): void {
    const size = wakeSize(cssW, cssH);
    this.a.setSize(size.w, size.h);
    this.b.setSize(size.w, size.h);
    this.u.uTexel.value.set(1 / size.w, 1 / size.h);
    this.u.uFrame.value.set(cssW, cssH);
    this.u.uRadius.value = stirRadius(cssW, cssH);
    this.dirty = true;
  }

  /** True while the field holds a flow worth drawing. */
  isLive(time: number): boolean {
    return wakeIsLive(time - this.lastStir);
  }

  /** The texture the composite reads. */
  get texture(): Texture {
    return this.a.texture;
  }

  /**
   * One step of the field: advect, spread, decay, and stir where the pointer went. Does nothing
   * for no time (a frozen frame) and clears itself once, when it has gone quiet.
   */
  step(renderer: WebGLRenderer, dt: number, time: number, stir: Stir | null): void {
    if (stir) this.lastStir = time;
    const live = this.isLive(time);
    if (!live) {
      if (this.dirty) {
        const previous = renderer.getRenderTarget();
        for (const t of [this.a, this.b]) {
          renderer.setRenderTarget(t);
          renderer.clear();
        }
        renderer.setRenderTarget(previous);
        this.dirty = false;
      }
      return;
    }
    if (!(dt > 0)) return;
    const u = this.u;
    u.tFlow.value = this.a.texture;
    u.uDt.value = Math.min(dt, 0.1);
    if (stir) {
      u.uStir.value = 1;
      u.uFrom.value.set(stir.fromX, stir.fromY);
      u.uTo.value.set(stir.toX, stir.toY);
      u.uForce.value.set(stir.forceX, stir.forceY);
    } else {
      u.uStir.value = 0;
    }
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(this.b);
    this.pass.render(renderer);
    renderer.setRenderTarget(previous);
    const swap = this.a;
    this.a = this.b;
    this.b = swap;
    this.dirty = true;
  }

  /** Forget the flow now (a jump of the page). */
  reset(): void {
    this.lastStir = -Infinity;
    this.dirty = true;
  }

  compile(renderer: WebGLRenderer): void {
    this.pass.compile(renderer);
  }

  dispose(): void {
    this.a.dispose();
    this.b.dispose();
    this.pass.dispose();
  }
}
