/**
 * The backdrop actor: what a section talks to. A section calls `set(kind, options)` every frame, like
 * it sets an actor visible; the kernel hides every actor before the sections run, so a backdrop that
 * no section sets in a frame fades out (and then costs nothing). The engine's clock runs `drawFrame`
 * after the sections, which integrates the cross-fade, smooths the numbers toward what was asked,
 * feeds the pointer and the scroll, and draws.
 *
 * It never throws and never takes the page down: with no WebGL, no host, or a context that is gone
 * for good, `set` is a no-op and the page keeps its plain grounds.
 */
import type { Actor, FrameInfo, PointerApi } from "../../kernel/types";
import { sameColors } from "./colors";
import { FADE_S, FadeMix } from "./mix";
import type { BackdropDrawable } from "./host";
import { BACKDROP_PALETTES, type BackdropKind, type BackdropTheme } from "./palettes";
import {
  approachK,
  approachParams,
  bufferScaleFor,
  bufferSize,
  copyParams,
  makeParams,
  writeNumbers,
  writePalette,
  type NumberOptions,
  type Params,
} from "./params";
import { BackdropGL, type FrameFeed, type LayerDraw } from "./renderer";
import { KIND_DEFS, type KindDef } from "./registry";
import { PointerTrail } from "./trail";

/** What a section may ask for. Everything is optional: the kind and the ground give the defaults. */
export interface BackdropOptions extends NumberOptions {
  /** One to four CSS colours. The default is the kind's palette for `theme`. */
  colors?: readonly string[];
  /** The ground the backdrop is on (the default is "daybreak"), which picks the palette. */
  theme?: BackdropTheme;
  /** The highlight colour of the kind (white on storm, a deep blue-grey on daybreak by default). */
  ink?: string;
  /**
   * Seconds the cross-fade takes when this kind comes in over another (0.5 by default, 0.1 at the
   * least). A scene that changes the kind every half second asks for a quicker one.
   */
  fade?: number;
}

export interface BackdropState {
  /** The kind that is coming in or standing. */
  readonly kind: BackdropKind | null;
  /** Every layer that is drawn, with its weight (they sum to the master's weight). */
  readonly layers: ReadonlyArray<{ readonly kind: BackdropKind; readonly weight: number }>;
  /** 0 to 1, the fade of the whole backdrop. */
  readonly presence: number;
  /** The canvas is shown and drawn this frame. */
  readonly drawing: boolean;
  /** Draw calls issued since the backdrop was made (none while it is hidden). */
  readonly draws: number;
  readonly buffer: { readonly w: number; readonly h: number };
  /** The context is there (false with no WebGL, no host or after it was lost for good). */
  readonly available: boolean;
}

/** What `ensureBackdrop` gives a section. */
export interface Backdrop extends Actor {
  /** Show `kind` this frame. Call it every frame the section wants it; calling it is what makes it visible. */
  set(kind: BackdropKind, options?: BackdropOptions): void;
  /** Compile the shaders of some kinds ahead of their first frame (call it in `mount`). */
  warm(kinds: readonly BackdropKind[]): Promise<void>;
  /** Put the end state in at once: no fade, no smoothing (a probe, a jump). */
  snap(): void;
  state(): BackdropState;
}

const NO_OPTIONS: BackdropOptions = Object.freeze({});
/** How fast the numbers follow a section's change, per second. */
const FOLLOW_RATE = 7;
const MAX_LAYERS = 3;

interface LayerState {
  phase: number;
  readonly cur: Params;
  readonly tgt: Params;
}

/** What the lab and the cost table use to time raw draws. */
export interface BackdropDebug {
  readonly gl: WebGL2RenderingContext;
  readonly canvas: HTMLCanvasElement;
  readonly gpu: string;
  /** Draw the last frame again, `times` times (no state moves). */
  redraw(times: number): void;
}

export class BackdropActor implements Backdrop, BackdropDrawable {
  readonly name = "backdrop";
  visible = false;
  private readonly gl: BackdropGL | null;
  private readonly mix = new FadeMix<BackdropKind>();
  private readonly states = new Map<BackdropKind, LayerState>();
  private readonly list: LayerDraw[] = [];
  private readonly trail = new PointerTrail();
  private readonly feed: FrameFeed = {
    pointerX: 0.5,
    pointerY: 0.5,
    pointerOn: 0,
    S: 0,
    vel: 0,
    trail: this.trail.data,
  };
  private readonly wantP = makeParams();
  private wantKind: BackdropKind | null = null;
  /** The cross-fade the last `set` asked for, in seconds. */
  private wantFade = FADE_S;
  private wantTheme: BackdropTheme = "daybreak";
  private wantColors: readonly string[] | undefined;
  private wantInk: string | undefined;
  private snapOnce = false;
  private draws = 0;
  private drawing = false;
  private count = 0;
  private cssW = 2;
  private cssH = 2;
  private bufW = 2;
  private bufH = 2;
  private sizedRes = -1;
  private sizedDpr = -1;
  private dirty = true;
  private readonly observer: ResizeObserver | null;
  private disposed = false;

  constructor(
    private readonly host: HTMLElement | null,
    private readonly pointer: PointerApi,
  ) {
    for (let i = 0; i < MAX_LAYERS; i++) {
      this.list.push({ kind: "aurora", weight: 0, time: 0, params: makeParams() });
    }
    let gl: BackdropGL | null = null;
    if (host) {
      try {
        gl = new BackdropGL(host, { onGone: () => undefined });
      } catch {
        gl = null;
      }
    }
    this.gl = gl;
    let observer: ResizeObserver | null = null;
    if (gl && host && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        this.dirty = true;
      });
      observer.observe(host);
    }
    this.observer = observer;
  }

  get available(): boolean {
    return this.gl !== null && !this.gl.gone;
  }

  set(kind: BackdropKind, options: BackdropOptions = NO_OPTIONS): void {
    this.visible = true;
    const def = (KIND_DEFS as Partial<Record<string, KindDef>>)[kind];
    if (!def) return;
    const theme = options.theme ?? "daybreak";
    const palette = BACKDROP_PALETTES[kind][theme];
    const w = this.wantP;
    if (
      kind !== this.wantKind ||
      theme !== this.wantTheme ||
      options.ink !== this.wantInk ||
      !sameColors(options.colors, this.wantColors)
    ) {
      writePalette(w, palette, options.colors, options.ink);
      this.wantColors = options.colors;
      this.wantInk = options.ink;
      this.wantTheme = theme;
    }
    writeNumbers(w, def, palette.intensity, options);
    this.wantFade = options.fade ?? FADE_S;
    this.wantKind = kind;
  }

  warm(kinds: readonly BackdropKind[]): Promise<void> {
    return this.gl ? this.gl.warm(kinds) : Promise.resolve();
  }

  snap(): void {
    this.snapOnce = true;
  }

  state(): BackdropState {
    return {
      kind: this.mix.top()?.kind ?? null,
      layers: this.mix.layers.map((l) => ({ kind: l.kind, weight: l.w * this.mix.master() })),
      presence: this.mix.master(),
      drawing: this.drawing,
      draws: this.draws,
      buffer: { w: this.gl?.bufferW ?? 0, h: this.gl?.bufferH ?? 0 },
      available: this.available,
    };
  }

  debug(): BackdropDebug | null {
    const gl = this.gl;
    if (!gl) return null;
    const ctx = gl.renderer.getContext();
    if (!(ctx instanceof WebGL2RenderingContext)) return null;
    return {
      gl: ctx,
      canvas: gl.canvas,
      gpu: gl.gpuName(),
      redraw: (times) => {
        for (let i = 0; i < times; i++) gl.draw(this.list, this.count, this.feed);
      },
    };
  }

  drawFrame(frame: FrameInfo, jumped: boolean): void {
    const gl = this.gl;
    if (!gl || this.disposed || gl.gone) return;
    const dt = frame.dt;
    const snap = jumped || this.snapOnce;
    this.snapOnce = false;

    const wasActive = this.mix.active();
    this.mix.step(dt, this.visible ? this.wantKind : null, snap, this.wantFade);
    if (!this.mix.active()) {
      // The draw-skip rule: nothing is drawn, the canvas leaves the paint, no state moves.
      this.drawing = false;
      this.count = 0;
      gl.setShown(false);
      return;
    }
    if (!wasActive) {
      this.states.clear();
      this.trail.clear();
    }

    const k = snap ? 1 : approachK(dt, FOLLOW_RATE);
    const master = this.mix.master();
    const top = this.mix.top();
    let res = 0;
    let n = 0;
    const layers = this.mix.layers;
    for (let i = 0; i < layers.length && n < MAX_LAYERS; i++) {
      const layer = layers[i]!;
      let st = this.states.get(layer.kind);
      if (!st) {
        st = { phase: this.wantP.seed * 41.7, cur: makeParams(), tgt: makeParams() };
        copyParams(st.tgt, this.wantP);
        copyParams(st.cur, st.tgt);
        this.states.set(layer.kind, st);
      }
      if (layer === top && layer.kind === this.wantKind) copyParams(st.tgt, this.wantP);
      approachParams(st.cur, st.tgt, k);
      st.phase += dt * st.cur.speed;
      const out = this.list[n]!;
      out.kind = layer.kind;
      out.weight = layer.w * master;
      out.time = st.phase;
      out.params = st.cur;
      res = Math.max(res, KIND_DEFS[layer.kind].res);
      n += 1;
    }
    if (this.states.size > n) this.pruneStates();

    this.size(res);
    this.feedFrame(frame, dt, snap);
    gl.setShown(true);
    this.drawing = true;
    this.count = n;
    this.draws += gl.draw(this.list, n, this.feed);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer?.disconnect();
    this.gl?.dispose();
  }

  /** Forget the layers that are no longer drawn (only when there are more states than layers). */
  private pruneStates(): void {
    for (const kind of Array.from(this.states.keys())) {
      if (!this.mix.layers.some((l) => l.kind === kind)) this.states.delete(kind);
    }
  }

  /** The buffer follows the canvas and the kind; it is worked out again only when one of them moved. */
  private size(res: number): void {
    const gl = this.gl;
    if (!gl || !this.host) return;
    const dpr = window.devicePixelRatio || 1;
    if (this.dirty) {
      const rect = this.host.getBoundingClientRect();
      this.cssW = Math.max(1, Math.round(rect.width || window.innerWidth));
      this.cssH = Math.max(1, Math.round(rect.height || window.innerHeight));
      this.dirty = false;
      this.sizedRes = -1;
    }
    if (res !== this.sizedRes || dpr !== this.sizedDpr) {
      const size = bufferSize(this.cssW, this.cssH, bufferScaleFor(res, dpr));
      this.bufW = size.w;
      this.bufH = size.h;
      this.sizedRes = res;
      this.sizedDpr = dpr;
    }
    gl.resize(this.bufW, this.bufH, this.cssW, this.cssH);
  }

  private feedFrame(frame: FrameInfo, dt: number, snap: boolean): void {
    const state = this.pointer.state;
    const feed = this.feed;
    const follow = snap ? 1 : approachK(dt, 10);
    if (state.inside) {
      feed.pointerX += (state.nx * 0.5 + 0.5 - feed.pointerX) * follow;
      feed.pointerY += (0.5 - state.ny * 0.5 - feed.pointerY) * follow;
    }
    feed.pointerOn += ((state.inside ? 1 : 0) - feed.pointerOn) * (snap ? 1 : approachK(dt, 5));
    // The ripples follow the raw pointer (the smoothed one would blur a quick flick into one).
    if (snap) this.trail.clear();
    this.trail.step(dt, state.nx * 0.5 + 0.5, 0.5 - state.ny * 0.5, state.inside, state.down);
    feed.S = frame.S;
    feed.vel += (Math.min(Math.abs(frame.velocity), 5) - feed.vel) * (snap ? 1 : approachK(dt, 6));
  }
}
