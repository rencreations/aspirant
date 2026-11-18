/**
 * The stage: the one WebGL renderer and the one canvas of the whole home page. There is never a
 * second context. A list of passes is drawn in order with autoclear off and the depth cleared
 * between them; a pass is a scene and a camera (`ScenePass`) or anything that draws (the picture
 * field, the logo, a post pass). The pixel ratio is the rule of the About drone: the display's,
 * at most 2, and low enough that the canvas stays under 8 million pixels.
 */
import {
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderTarget,
  WebGLRenderer,
  type RenderTargetOptions,
} from "three";

import { hasWebGL } from "@/components/gl/use-gl-ready";

import type { FrameInfo, Pass } from "./types";

/** The most pixels the canvas may hold (the About drone's budget). */
export const PIXEL_BUDGET = 8e6;
export const MAX_DPR = 2;
/** The camera distance at which a perspective camera shows one unit as one CSS pixel at z = 0. */
export const PIXEL_DISTANCE = 1000;
/** How long a lost context may take to come back before the stage is rebuilt. */
const RESTORE_WAIT_MS = 1500;
/** The stage is rebuilt at most this many times, then it gives up (the page falls back to plain). */
const REBUILDS = 3;

/** The pixel ratio for a canvas of `w` by `h` CSS pixels on a display of ratio `dpr`. */
export function pixelRatioFor(w: number, h: number, dpr: number): number {
  const wanted = Math.min(dpr > 0 ? dpr : 1, MAX_DPR);
  return Math.min(wanted, Math.sqrt(PIXEL_BUDGET / Math.max(1, w * h)));
}

/** The vertical field of view, in degrees, at which a camera `z` away shows `h` pixels of height at z = 0. */
export function pixelFov(h: number, z: number = PIXEL_DISTANCE): number {
  return (2 * Math.atan(h / 2 / z) * 180) / Math.PI;
}

/**
 * An orthographic camera in pixels: one unit is one CSS pixel, the origin is the centre of the
 * screen and y points up. Things at z = 0 are on the picture plane.
 */
export function makePixelOrthoCamera(w: number, h: number): OrthographicCamera {
  const camera = new OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, -2000, 2000);
  camera.position.set(0, 0, 0);
  return camera;
}

/**
 * A perspective camera that matches pixels at z = 0: a plane at z = 0 that is `w` by `h` units fills
 * the screen exactly. Things nearer than z = 0 grow, things farther shrink.
 */
export function makePixelPerspectiveCamera(
  w: number,
  h: number,
  z: number = PIXEL_DISTANCE,
): PerspectiveCamera {
  const camera = new PerspectiveCamera(pixelFov(h, z), w / Math.max(1, h), z * 0.01, z * 40);
  camera.position.set(0, 0, z);
  camera.lookAt(0, 0, 0);
  return camera;
}

/** Fit an existing orthographic pixel camera to a new screen size. */
function fitOrtho(camera: OrthographicCamera, w: number, h: number): void {
  camera.left = -w / 2;
  camera.right = w / 2;
  camera.top = h / 2;
  camera.bottom = -h / 2;
  camera.updateProjectionMatrix();
}

/** Fit an existing perspective pixel camera to a new screen size. */
function fitPerspective(camera: PerspectiveCamera, w: number, h: number, z: number): void {
  camera.fov = pixelFov(h, z);
  camera.aspect = w / Math.max(1, h);
  camera.position.set(0, 0, z);
  camera.updateProjectionMatrix();
}

/** A pass made of one scene and one pixel camera. Anything visible in the scene is drawn. */
export class ScenePass implements Pass {
  readonly scene = new Scene();
  readonly camera: OrthographicCamera | PerspectiveCamera;

  constructor(
    readonly name: string,
    readonly order: number,
    readonly kind: "ortho" | "perspective",
    w: number,
    h: number,
    private readonly distance: number = PIXEL_DISTANCE,
  ) {
    this.camera =
      kind === "ortho"
        ? makePixelOrthoCamera(w, h)
        : makePixelPerspectiveCamera(w, h, this.distance);
  }

  active(): boolean {
    return this.scene.children.some((child) => child.visible);
  }

  render(renderer: WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
  }

  resize(w: number, h: number): void {
    if (this.camera instanceof OrthographicCamera) fitOrtho(this.camera, w, h);
    else fitPerspective(this.camera, w, h, this.distance);
  }
}

/** A render target that follows the size of the canvas: `scale` of its device pixels. */
export class StageTarget {
  readonly target: WebGLRenderTarget;

  constructor(
    private readonly scale: number,
    options: RenderTargetOptions,
    deviceW: number,
    deviceH: number,
  ) {
    this.target = new WebGLRenderTarget(
      Math.max(1, Math.round(deviceW * scale)),
      Math.max(1, Math.round(deviceH * scale)),
      options,
    );
  }

  /** The canvas is now `deviceW` by `deviceH` device pixels. */
  resize(deviceW: number, deviceH: number): void {
    this.target.setSize(
      Math.max(1, Math.round(deviceW * this.scale)),
      Math.max(1, Math.round(deviceH * this.scale)),
    );
  }

  dispose(): void {
    this.target.dispose();
  }
}

export interface StageHooks {
  onLost(): void;
  onRestored(): void;
  /** The context could not be brought back after `REBUILDS` tries. */
  onFailed(): void;
}

export class Stage {
  canvas: HTMLCanvasElement;
  renderer: WebGLRenderer;
  /** CSS pixels. */
  width = 1;
  height = 1;
  dpr = 1;
  lost = false;
  failed = false;
  private readonly passes: Pass[] = [];
  private readonly targets: StageTarget[] = [];
  private restoreTimer = 0;
  private rebuilds = 0;
  private dirty = false;
  private disposed = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly hooks: StageHooks,
  ) {
    const made = this.makeRenderer();
    this.canvas = made.canvas;
    this.renderer = made.renderer;
    this.measure();
  }

  /** Add a pass. Returns the way to take it out. */
  addPass(pass: Pass): () => void {
    this.passes.push(pass);
    this.passes.sort((a, b) => a.order - b.order);
    pass.resize?.(this.width, this.height);
    return () => {
      const at = this.passes.indexOf(pass);
      if (at >= 0) this.passes.splice(at, 1);
      pass.dispose?.();
    };
  }

  /**
   * The shared scene pass of a kind: made the first time it is asked for, found afterwards. Sections
   * put their meshes in it and set them visible or hidden through their actors. `order` places it.
   */
  scenePass(name: string, kind: "ortho" | "perspective", order: number): ScenePass {
    const existing = this.passes.find((p) => p.name === name);
    if (existing instanceof ScenePass) return existing;
    const pass = new ScenePass(name, order, kind, this.width, this.height);
    this.addPass(pass);
    return pass;
  }

  /** A render target at `scale` of the canvas's size in device pixels. It follows the screen. */
  target(scale = 1, options: RenderTargetOptions = {}): StageTarget {
    const t = new StageTarget(scale, options, this.width * this.dpr, this.height * this.dpr);
    this.targets.push(t);
    return t;
  }

  passNames(): string[] {
    return this.passes.map((p) => p.name);
  }

  /** Measure the host again and resize the canvas, the passes and the targets. */
  resize(): void {
    if (this.disposed) return;
    this.measure();
  }

  /** Draw the passes that have something to show. Draws nothing while the context is lost. */
  draw(frame: FrameInfo): void {
    if (this.disposed || this.lost || this.failed) return;
    const active = this.passes.filter((p) => p.active());
    if (active.length === 0) {
      if (this.dirty) {
        this.renderer.setRenderTarget(null);
        this.renderer.clear();
        this.dirty = false;
      }
      return;
    }
    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    for (const pass of active) {
      this.renderer.clearDepth();
      pass.render(this.renderer, frame);
    }
    this.dirty = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.clearTimeout(this.restoreTimer);
    this.detach(this.canvas);
    for (const pass of this.passes) pass.dispose?.();
    this.passes.length = 0;
    for (const t of this.targets) t.dispose();
    this.targets.length = 0;
    this.release();
  }

  private measure(): void {
    const rect = this.host.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width || window.innerWidth));
    const h = Math.max(1, Math.round(rect.height || window.innerHeight));
    this.width = w;
    this.height = h;
    this.dpr = pixelRatioFor(w, h, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    for (const pass of this.passes) pass.resize?.(w, h);
    for (const t of this.targets) t.resize(w * this.dpr, h * this.dpr);
  }

  private makeRenderer(): { canvas: HTMLCanvasElement; renderer: WebGLRenderer } {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.homeCanvas = "";
    const renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.autoClear = false;
    renderer.outputColorSpace = SRGBColorSpace;
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

  /** Give the GL context back to the browser and take the canvas out. */
  private release(): void {
    this.renderer.dispose();
    // A context that is already lost has no extension to lose it with (three warns about that).
    if (!this.lost) this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  private readonly onLost = (event: Event): void => {
    event.preventDefault();
    this.lost = true;
    this.hooks.onLost();
    window.clearTimeout(this.restoreTimer);
    this.restoreTimer = window.setTimeout(() => {
      this.rebuild();
    }, RESTORE_WAIT_MS);
  };

  private readonly onRestored = (): void => {
    window.clearTimeout(this.restoreTimer);
    this.lost = false;
    for (const pass of this.passes) pass.rebuild?.();
    this.hooks.onRestored();
  };

  /** The context did not come back: make a new canvas and renderer, keep the passes. */
  private rebuild(): void {
    if (this.disposed) return;
    this.rebuilds += 1;
    if (this.rebuilds > REBUILDS) {
      this.failed = true;
      this.hooks.onFailed();
      return;
    }
    this.detach(this.canvas);
    this.release();
    try {
      const made = this.makeRenderer();
      this.canvas = made.canvas;
      this.renderer = made.renderer;
    } catch {
      this.failed = true;
      this.hooks.onFailed();
      return;
    }
    this.lost = false;
    this.dirty = false;
    this.measure();
    for (const pass of this.passes) pass.rebuild?.();
    this.hooks.onRestored();
  }
}

/**
 * Make the stage in `host`, or null when this browser cannot make a WebGL context (a failure the
 * page handles by laying itself out as plain text). Never throws and never makes a second stage
 * (the caller keeps one).
 */
export function createStage(host: HTMLElement, hooks: StageHooks): Stage | null {
  if (!hasWebGL()) return null;
  try {
    return new Stage(host, hooks);
  } catch {
    return null;
  }
}
