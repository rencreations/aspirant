import { Mesh, Program, Renderer, RenderTarget, Texture, Triangle } from "ogl";

import {
  bufferRatio,
  easeLook,
  easeWash,
  hexRgb,
  mixLook,
  slatScale,
  type SlatsLook,
} from "./look";
import {
  advectFragment,
  curlFragment,
  divergenceFragment,
  fieldFragment,
  fluidVertex,
  passVertex,
  pressureFragment,
  projectFragment,
  scaleFragment,
  slatFragment,
  splatFragment,
  vorticityFragment,
} from "./shaders";

/**
 * The slat field behind the Animation room: React Bits' MicroSlats ported to TypeScript, outside
 * React. One `ogl` context on one canvas. The sea rolls on its own; the pointer (a mouse or a
 * finger) pushes a small fluid that bends the swell and leaves a trail of light, and a press
 * throws a splash.
 *
 * What we changed from the original: a change of look rolls in from the horizon (`setLook`), the
 * loop stops while the tab is hidden, while the field is off screen and while the room covers it
 * (`setActive`), the buffer has a pixel budget, the slats are scaled to the screen, the canvas is
 * opaque, and the visitor's reduced motion setting is not read (the site has one version).
 */

/** The fluid grid: this many cells on the short side. */
const FLUID_SIZE = 96;
const PRESSURE_STEPS = 16;
const SPLAT_FORCE = 6900;
const SPLASH_JETS = 3;
/** The most pixels the canvas draws per frame (about 1920 by 1200 at a ratio of 1.25). */
const PIXEL_BUDGET = 3.6e6;
/**
 * How the pointer stirs the water: the original's defaults, with a brighter trail (the room is
 * dark and the owner asked for a field that clearly answers the cursor) and a little swirl.
 */
const CURSOR = { size: 46, strength: 1.9, trail: 1.6, swirl: 0.25, lean: 0 };
const INTRO_S = 1.5;
/** A change of look takes this long; its front starts above the screen and leaves below it. */
const WASH_MS = 1300;
const WASH_END = 1.3;

type Vec3 = [number, number, number];
type Splat = [u: number, v: number, du: number, dv: number, turn: number | null];

interface Pair {
  read: RenderTarget;
  write: RenderTarget;
  swap: () => void;
}

interface Fluid {
  width: number;
  height: number;
  velocity: Pair;
  ink: Pair;
  pressure: Pair;
  divergence: RenderTarget;
  curl: RenderTarget;
}

interface Grid {
  slatW: number;
  slatH: number;
  tilt: number;
  grid: [cols: number, rows: number, pitchX: number, pitchY: number];
  origin: [x: number, y: number];
}

/** What a probe can read: the look in front, and the cost of the last frames. */
export interface SlatsSnapshot {
  color: string;
  glint: string;
  ground: string;
  /** 0 to 1 while a new look rolls in, 1 when it has arrived. */
  wash: number;
  running: boolean;
  frames: number;
  /** Mean time of the field's own work per drawn frame, in ms, over the last 120 frames. */
  meanMs: number;
  /** The slowest of those frames, in ms. */
  maxMs: number;
  dpr: number;
  cols: number;
  rows: number;
}

const rgb = (hex: string): Vec3 => [...hexRgb(hex)];
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

function fieldUniforms(blank: Texture) {
  return {
    uSize: { value: [1, 1] },
    uGrid: { value: [1, 1, 1, 1] },
    uOrigin: { value: [0, 0] },
    uSlat: { value: [1, 1] },
    uTime: { value: 0 },
    uScale: { value: 1 },
    uDirection: { value: 0 },
    uChop: { value: 0.5 },
    uStretch: { value: 0.3 },
    uGlint: { value: 1 },
    uContrast: { value: 1 },
    uPerspective: { value: 0.7 },
    uFog: { value: 0.5 },
    uIntro: { value: 0 },
    uWash: { value: WASH_END },
    tVelocity: { value: blank },
    tInk: { value: blank },
    uFluidTexel: { value: [1, 1] },
    uFluid: { value: 0 },
    uInk: { value: CURSOR.strength },
    uLean: { value: CURSOR.lean },
  };
}

/** The uniforms of the fluid passes, kept typed so a pass is fed without going through `any`. */
function passUniforms(blank: Texture) {
  return {
    splat: {
      uTarget: { value: blank },
      uAspect: { value: 1 },
      uPoint: { value: [0, 0] },
      uValue: { value: [0, 0, 0] },
      uRadius: { value: 0.01 },
    },
    curl: { uVelocity: { value: blank } },
    vorticity: {
      uVelocity: { value: blank },
      uCurl: { value: blank },
      uSwirl: { value: 20 },
      uDt: { value: 0.016 },
    },
    divergence: { uVelocity: { value: blank } },
    pressure: { uPressure: { value: blank }, uDivergence: { value: blank } },
    project: { uPressure: { value: blank }, uVelocity: { value: blank } },
    advect: {
      uVelocity: { value: blank },
      uSource: { value: blank },
      uDt: { value: 0.016 },
      uFade: { value: 1 },
    },
    scale: { uSource: { value: blank }, uValue: { value: 0 } },
  };
}

type PassName = keyof ReturnType<typeof passUniforms>;

function slatUniforms(field: Texture, look: SlatsLook) {
  return {
    tField: { value: field },
    uSize: { value: [1, 1] },
    uDpr: { value: 1 },
    uGrid: { value: [1, 1, 1, 1] },
    uOrigin: { value: [0, 0] },
    uSlat: { value: [1, 1] },
    uRound: { value: 1 },
    uTilt: { value: 0 },
    uColorA: { value: rgb(look.color) },
    uGlintA: { value: rgb(look.glint) },
    uGroundA: { value: rgb(look.ground) },
    uColorB: { value: rgb(look.color) },
    uGlintB: { value: rgb(look.glint) },
    uGroundB: { value: rgb(look.ground) },
    uWash: { value: WASH_END },
  };
}

export class SlatsEngine {
  private readonly host: HTMLElement;
  private readonly renderer: Renderer;
  private readonly gl: Renderer["gl"];
  private readonly canvas: HTMLCanvasElement;
  private readonly blank: Texture;
  private readonly floatTargets: boolean;
  private readonly field: ReturnType<typeof fieldUniforms>;
  private readonly slats: ReturnType<typeof slatUniforms>;
  private readonly fieldMesh: Mesh;
  private readonly slatMesh: Mesh;
  private readonly fluidTexel = { value: [1, 1] };
  private readonly passes: Record<PassName, Mesh>;
  private readonly u: ReturnType<typeof passUniforms>;
  private fieldTarget: RenderTarget;
  private fluid: Fluid | null = null;
  private grid: Grid | null = null;

  private width = 1;
  private height = 1;
  private left = 0;
  private top = 0;
  private raf = 0;
  private last = 0;
  private time = 0;
  private intro = 0;
  private alive = true;
  private onScreen = true;
  private active = true;
  private resizePending = true;
  private fluidUntil = 0;
  private fluidDirty = false;
  private splashTurn = 0;
  private readonly splats: Splat[] = [];
  private readonly pointer = { x: 0, y: 0, tracked: false };

  /** The look before a change, the look after it, and when the change started. */
  private from: SlatsLook;
  private to: SlatsLook;
  private changeAt = Number.NEGATIVE_INFINITY;
  /** Frame sheets: the change of look held this many ms after it began, or null to run. */
  private held: number | null = null;

  private frames = 0;
  private readonly costs: number[] = [];

  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver;
  private readonly onLost: () => void;

  /**
   * A field in `host`, or null when the browser has no WebGL 2 (the host keeps its own colour).
   * `onLost` is called if the GPU drops the context: the caller builds a new field.
   */
  static create(host: HTMLElement, look: SlatsLook, onLost: () => void): SlatsEngine | null {
    try {
      const renderer = new Renderer({
        alpha: false,
        antialias: false,
        depth: false,
        premultipliedAlpha: false,
        powerPreference: "high-performance",
      });
      if (!renderer.isWebgl2) {
        renderer.gl.getExtension("WEBGL_lose_context")?.loseContext();
        return null;
      }
      return new SlatsEngine(host, renderer, look, onLost);
    } catch {
      return null;
    }
  }

  private constructor(host: HTMLElement, renderer: Renderer, look: SlatsLook, onLost: () => void) {
    this.host = host;
    this.renderer = renderer;
    this.onLost = onLost;
    const gl = renderer.gl;
    this.gl = gl;
    this.from = look;
    this.to = look;
    this.canvas = gl.canvas;
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.addEventListener("webglcontextlost", this.onContextLost);
    host.appendChild(this.canvas);

    const geometry = new Triangle(gl);
    this.blank = new Texture(gl);
    this.floatTargets = !!(
      gl.getExtension("EXT_color_buffer_float") ?? gl.getExtension("EXT_color_buffer_half_float")
    );

    const program = (fragment: string, uniforms: Record<string, unknown>, vertex = passVertex) =>
      new Program(gl, { vertex, fragment, uniforms, depthTest: false, depthWrite: false });
    this.fieldTarget = this.cellTarget(1, 1);
    this.field = fieldUniforms(this.blank);
    this.fieldMesh = new Mesh(gl, { geometry, program: program(fieldFragment, this.field) });
    this.slats = slatUniforms(this.fieldTarget.texture, look);
    this.slatMesh = new Mesh(gl, { geometry, program: program(slatFragment, this.slats) });

    const pass = (fragment: string, uniforms: Record<string, unknown>) =>
      new Mesh(gl, {
        geometry,
        program: program(fragment, { uTexel: this.fluidTexel, ...uniforms }, fluidVertex),
      });
    this.u = passUniforms(this.blank);
    this.passes = {
      splat: pass(splatFragment, this.u.splat),
      curl: pass(curlFragment, this.u.curl),
      vorticity: pass(vorticityFragment, this.u.vorticity),
      divergence: pass(divergenceFragment, this.u.divergence),
      pressure: pass(pressureFragment, this.u.pressure),
      project: pass(projectFragment, this.u.project),
      advect: pass(advectFragment, this.u.advect),
      scale: pass(scaleFragment, this.u.scale),
    };

    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    window.addEventListener("pointerdown", this.onPointerDown, { passive: true });
    window.addEventListener("pointerout", this.onPointerOut, { passive: true });
    window.addEventListener("blur", this.onPointerLeave);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.resizeObserver = new ResizeObserver(this.onResize);
    this.resizeObserver.observe(host);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.onScreen = entry?.isIntersecting ?? true;
      this.start();
    });
    this.intersectionObserver.observe(host);
    this.start();
  }

  /** Roll a new look in from the horizon. A change during a change starts from what shows. */
  setLook(look: SlatsLook, now = performance.now()): void {
    if (look === this.to) return;
    const k = this.washProgress(now);
    this.from = k < 1 ? mixLook(this.from, this.to, easeLook(k)) : this.to;
    this.to = look;
    this.changeAt = now;
    this.slats.uColorA.value = rgb(this.from.color);
    this.slats.uGlintA.value = rgb(this.from.glint);
    this.slats.uGroundA.value = rgb(this.from.ground);
    this.slats.uColorB.value = rgb(look.color);
    this.slats.uGlintB.value = rgb(look.glint);
    this.slats.uGroundB.value = rgb(look.ground);
    this.start();
  }

  /** Frame sheets: hold the change of look `ms` after it began (null lets it run on). */
  holdWash(ms: number | null): void {
    this.held = ms;
    this.start();
  }

  /** False while the room covers the field (its full screen view): nothing is drawn. */
  setActive(on: boolean): void {
    this.active = on;
    this.start();
  }

  snapshot(): SlatsSnapshot {
    const n = this.costs.length;
    return {
      color: this.to.color,
      glint: this.to.glint,
      ground: this.to.ground,
      wash: this.washProgress(performance.now()),
      running: this.raf !== 0,
      frames: this.frames,
      meanMs: n ? this.costs.reduce((s, v) => s + v, 0) / n : 0,
      maxMs: n ? Math.max(...this.costs) : 0,
      dpr: this.renderer.dpr,
      cols: this.grid?.grid[0] ?? 0,
      rows: this.grid?.grid[1] ?? 0,
    };
  }

  destroy(): void {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerout", this.onPointerOut);
    window.removeEventListener("blur", this.onPointerLeave);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    if (!this.gl.isContextLost()) {
      this.disposeFluid();
      this.dispose(this.fieldTarget);
      this.gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.canvas.remove();
  }

  // The loop ----------------------------------------------------------------------------------------

  private get running(): boolean {
    return this.alive && this.onScreen && this.active && !document.hidden;
  }

  private start(): void {
    if (this.raf || !this.running) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private washProgress(now: number): number {
    const elapsed = this.held ?? now - this.changeAt;
    return Math.min(1, Math.max(0, elapsed / WASH_MS));
  }

  private readonly frame = (now: number) => {
    this.raf = 0;
    if (!this.running) return;
    const began = performance.now();
    if (this.resizePending) {
      this.resizePending = false;
      this.applyResize();
    }
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;

    // The look: the numbers ease over the change, the colours roll in with the front.
    const k = this.washProgress(now);
    const eased = easeLook(k);
    const look = k >= 1 ? this.to : mixLook(this.from, this.to, eased);
    // The front answers at once and settles as it leaves the screen.
    const wash = k >= 1 ? WASH_END : easeWash(k) * WASH_END;
    const sea = look.sea;

    this.time += dt * sea.speed;
    this.intro = Math.min(1, this.intro + dt / INTRO_S);

    this.stirFluid(now, dt);
    const grid = this.layout(look);
    const fluidActive = this.fluid !== null && now < this.fluidUntil;

    const f = this.field;
    f.uSize.value = [this.width, this.height];
    f.uGrid.value = grid.grid;
    f.uOrigin.value = grid.origin;
    f.uSlat.value = [grid.slatW, grid.slatH];
    f.uTime.value = this.time;
    f.uScale.value = sea.scale;
    f.uDirection.value = (sea.direction * Math.PI) / 180;
    f.uChop.value = clamp(sea.chop, 0, 1.5);
    f.uStretch.value = clamp(sea.stretch, 0, 0.95);
    f.uGlint.value = Math.max(0, sea.glint);
    f.uContrast.value = clamp(sea.contrast, 0.2, 4);
    f.uPerspective.value = clamp(sea.perspective, 0, 1);
    f.uFog.value = clamp(sea.fog, 0, 1);
    f.uIntro.value = easeLook(this.intro);
    f.uWash.value = wash;
    f.uFluid.value = fluidActive ? 1 : 0;
    f.tVelocity.value = this.fluid ? this.fluid.velocity.read.texture : this.blank;
    f.tInk.value = this.fluid ? this.fluid.ink.read.texture : this.blank;
    f.uFluidTexel.value = this.fluidTexel.value;
    this.renderer.render({ scene: this.fieldMesh, target: this.fieldTarget, clear: false });

    const s = this.slats;
    s.uSize.value = [this.width, this.height];
    s.uDpr.value = this.renderer.dpr;
    s.uGrid.value = grid.grid;
    s.uOrigin.value = grid.origin;
    s.uSlat.value = [grid.slatW, grid.slatH];
    s.uRound.value = clamp(look.roundness, 0, 1);
    s.uTilt.value = fluidActive && CURSOR.lean > 0 ? grid.tilt : 0;
    s.uWash.value = wash;
    this.renderer.render({ scene: this.slatMesh, clear: false });

    this.frames += 1;
    this.costs.push(performance.now() - began);
    if (this.costs.length > 120) this.costs.shift();
    // The sea always rolls: draw the next frame while the field can be seen.
    this.start();
  };

  // Size ----------------------------------------------------------------------------------------------

  private readonly onResize = () => {
    this.resizePending = true;
    this.start();
  };

  private applyResize(): void {
    const rect = this.host.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.left = rect.left;
    this.top = rect.top;
    this.renderer.dpr = bufferRatio(
      { w: this.width, h: this.height },
      window.devicePixelRatio,
      PIXEL_BUDGET,
    );
    this.renderer.setSize(this.width, this.height);
    this.buildFluid();
  }

  /** A render target of one texel per slat. It only grows, so a change of slat size reuses it. */
  private cellTarget(width: number, height: number): RenderTarget {
    return new RenderTarget(this.gl, {
      width,
      height,
      depth: false,
      minFilter: this.gl.NEAREST,
      magFilter: this.gl.NEAREST,
    });
  }

  private layout(look: SlatsLook): Grid {
    const k = slatScale({ w: this.width, h: this.height });
    const slatW = clamp(look.slatWidth * k, 1, 64);
    const slatH = clamp(look.slatHeight * k, 2, 240);
    const gap = clamp(look.gap * k, 0, 64);
    const pitchX = slatW + gap;
    const pitchY = slatH + gap;
    const cols = Math.min(2048, Math.ceil((this.width + gap) / pitchX) + 1);
    const rows = Math.min(2048, Math.ceil((this.height + gap) / pitchY) + 1);
    if (this.fieldTarget.width < cols || this.fieldTarget.height < rows) {
      const w = Math.max(cols, this.fieldTarget.width);
      const h = Math.max(rows, this.fieldTarget.height);
      this.dispose(this.fieldTarget);
      this.fieldTarget = this.cellTarget(w, h);
      this.slats.tField.value = this.fieldTarget.texture;
    }
    const tilt = Math.min(
      0.42,
      Math.asin(clamp((pitchX * 1.5 - slatW * 0.5) / (slatH * 0.5), 0, 1)),
    );
    this.grid = {
      slatW,
      slatH,
      tilt,
      grid: [cols, rows, pitchX, pitchY],
      origin: [(this.width - (cols * pitchX - gap)) / 2, (this.height - (rows * pitchY - gap)) / 2],
    };
    return this.grid;
  }

  // The fluid -----------------------------------------------------------------------------------------

  private floatTarget(w: number, h: number): RenderTarget {
    const gl = this.gl as WebGL2RenderingContext;
    return new RenderTarget(this.gl, {
      width: w,
      height: h,
      depth: false,
      type: gl.HALF_FLOAT,
      format: gl.RGBA,
      internalFormat: gl.RGBA16F,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
    });
  }

  private swapPair(w: number, h: number): Pair {
    const pair: Pair = {
      read: this.floatTarget(w, h),
      write: this.floatTarget(w, h),
      swap: () => {
        const next = pair.read;
        pair.read = pair.write;
        pair.write = next;
      },
    };
    return pair;
  }

  private dispose(target: RenderTarget): void {
    this.gl.deleteFramebuffer(target.buffer);
    this.gl.deleteTexture(target.texture.texture);
  }

  private disposeFluid(): void {
    const f = this.fluid;
    if (!f) return;
    for (const pair of [f.velocity, f.ink, f.pressure]) {
      this.dispose(pair.read);
      this.dispose(pair.write);
    }
    this.dispose(f.divergence);
    this.dispose(f.curl);
    this.fluid = null;
  }

  private buildFluid(): void {
    if (!this.floatTargets) return;
    const aspect = this.width / this.height;
    const w = Math.max(8, Math.round(aspect >= 1 ? FLUID_SIZE * aspect : FLUID_SIZE));
    const h = Math.max(8, Math.round(aspect >= 1 ? FLUID_SIZE : FLUID_SIZE / aspect));
    if (this.fluid?.width === w && this.fluid.height === h) return;
    this.disposeFluid();
    this.fluid = {
      width: w,
      height: h,
      velocity: this.swapPair(w, h),
      ink: this.swapPair(w, h),
      pressure: this.swapPair(w, h),
      divergence: this.floatTarget(w, h),
      curl: this.floatTarget(w, h),
    };
    this.fluidTexel.value = [1 / w, 1 / h];
  }

  private run(mesh: Mesh, target: RenderTarget): void {
    this.renderer.render({ scene: mesh, target, clear: false });
  }

  private splat(pair: Pair, point: number[], value: number[], radius: number): void {
    const u = this.u.splat;
    u.uTarget.value = pair.read.texture;
    u.uAspect.value = this.width / this.height;
    u.uPoint.value = point;
    u.uValue.value = value;
    u.uRadius.value = radius;
    this.run(this.passes.splat, pair.write);
    pair.swap();
  }

  /** Feed the queued strokes and splashes in, then move the water one step. */
  private stirFluid(now: number, dt: number): void {
    const fluid = this.fluid;
    if (!fluid) return;
    if (this.splats.length) {
      const radius = (clamp(CURSOR.size, 4, 600) / this.height) ** 2 * 0.35;
      const aspect = this.width / this.height;
      for (const [u, v, du, dv, turn] of this.splats) {
        if (turn === null) {
          this.splat(fluid.velocity, [u, v], [du * SPLAT_FORCE, dv * SPLAT_FORCE, 0], radius);
          this.splat(fluid.ink, [u, v], [0.13, 0, 0], radius);
          continue;
        }
        const jet = radius * 0.55;
        const reach = Math.sqrt(jet * 0.5) * 1.9;
        const push = SPLAT_FORCE * 0.08;
        for (let i = 0; i < SPLASH_JETS; i++) {
          const angle = turn + (i / SPLASH_JETS) * Math.PI * 2;
          const dx = Math.cos(angle);
          const dy = Math.sin(angle);
          const point = [u + (dx * reach) / aspect, v + dy * reach];
          const spin = [(dx - dy) * Math.SQRT1_2 * push, (dy + dx) * Math.SQRT1_2 * push, 0];
          this.splat(fluid.velocity, point, spin, jet);
          this.splat(fluid.ink, point, [0.75, 0, 0], jet);
        }
        this.splat(fluid.ink, [u, v], [0.45, 0, 0], radius);
      }
      this.splats.length = 0;
      this.fluidDirty = true;
    }
    if (now < this.fluidUntil) this.stepFluid(fluid, Math.min(Math.max(dt, 1 / 240), 1 / 30));
    else if (this.fluidDirty) {
      this.clearFluid(fluid);
      this.fluidDirty = false;
    }
  }

  private stepFluid(f: Fluid, dt: number): void {
    const p = this.passes;
    const u = this.u;
    if (CURSOR.swirl > 0) {
      u.curl.uVelocity.value = f.velocity.read.texture;
      this.run(p.curl, f.curl);
      const vorticity = u.vorticity;
      vorticity.uVelocity.value = f.velocity.read.texture;
      vorticity.uCurl.value = f.curl.texture;
      vorticity.uSwirl.value = clamp(CURSOR.swirl, 0, 2) * 40;
      vorticity.uDt.value = dt;
      this.run(p.vorticity, f.velocity.write);
      f.velocity.swap();
    }

    u.divergence.uVelocity.value = f.velocity.read.texture;
    this.run(p.divergence, f.divergence);

    u.scale.uSource.value = f.pressure.read.texture;
    u.scale.uValue.value = 0.8;
    this.run(p.scale, f.pressure.write);
    f.pressure.swap();

    u.pressure.uDivergence.value = f.divergence.texture;
    for (let i = 0; i < PRESSURE_STEPS; i++) {
      u.pressure.uPressure.value = f.pressure.read.texture;
      this.run(p.pressure, f.pressure.write);
      f.pressure.swap();
    }

    u.project.uPressure.value = f.pressure.read.texture;
    u.project.uVelocity.value = f.velocity.read.texture;
    this.run(p.project, f.velocity.write);
    f.velocity.swap();

    const fade = 1 / clamp(CURSOR.trail, 0.1, 10);
    const advect = u.advect;
    advect.uDt.value = dt;
    advect.uVelocity.value = f.velocity.read.texture;
    advect.uSource.value = f.velocity.read.texture;
    advect.uFade.value = fade * 1.4;
    this.run(p.advect, f.velocity.write);
    f.velocity.swap();

    advect.uVelocity.value = f.velocity.read.texture;
    advect.uSource.value = f.ink.read.texture;
    advect.uFade.value = fade;
    this.run(p.advect, f.ink.write);
    f.ink.swap();
  }

  private clearFluid(f: Fluid): void {
    const scale = this.u.scale;
    scale.uValue.value = 0;
    for (const pair of [f.velocity, f.ink, f.pressure]) {
      scale.uSource.value = pair.read.texture;
      this.run(this.passes.scale, pair.write);
      pair.swap();
    }
  }

  // The pointer ---------------------------------------------------------------------------------------

  /** Where an event falls on the field. The field's box is measured on resize, never here. */
  private locate(e: PointerEvent) {
    const x = e.clientX - this.left;
    const y = e.clientY - this.top;
    const w = this.width;
    const h = this.height;
    return { x, y, u: x / w, v: 1 - y / h, h, inside: x >= 0 && y >= 0 && x <= w && y <= h };
  }

  private queue(splat: Splat): void {
    if (this.splats.length > 32) this.splats.shift();
    this.splats.push(splat);
    this.fluidUntil = performance.now() + Math.max(1.5, CURSOR.trail * 5) * 1000;
    this.start();
  }

  private readonly onPointerMove = (e: PointerEvent) => {
    const spot = this.locate(e);
    if (!this.fluid || !this.running || !spot.inside) {
      this.pointer.tracked = false;
      return;
    }
    const p = this.pointer;
    if (p.tracked && (spot.x !== p.x || spot.y !== p.y)) {
      this.queue([spot.u, spot.v, (spot.x - p.x) / spot.h, (p.y - spot.y) / spot.h, null]);
    }
    p.x = spot.x;
    p.y = spot.y;
    p.tracked = true;
  };

  private readonly onPointerDown = (e: PointerEvent) => {
    const spot = this.locate(e);
    if (!this.fluid || !this.running || !spot.inside) return;
    this.splashTurn += 2.39996;
    this.queue([spot.u, spot.v, 0, 0, this.splashTurn]);
  };

  private readonly onPointerLeave = () => {
    this.pointer.tracked = false;
  };

  private readonly onPointerOut = (e: PointerEvent) => {
    if (!e.relatedTarget) this.onPointerLeave();
  };

  private readonly onVisibility = () => {
    this.start();
  };

  private readonly onContextLost = (e: Event) => {
    e.preventDefault();
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.onLost();
  };
}
