/**
 * The energy of the visitor's scroll input: how hard the wheel or the finger is pushing the page,
 * as one signed number in pixels per second (`FrameInfo.input.wheel`). A section reads it to speed
 * something up with the push (the rows). It is measured from the input itself (wheel deltas and touch
 * moves), not from the page's position, so it keeps measuring while the scroll is held by a play and
 * the page does not move.
 *
 * The smoothing is an exponential average of the rate with a time constant of 140 ms: a steady push
 * of 600 px/s reads 600, and when the visitor lets go it falls to a third in 140 ms. Pure arithmetic
 * (`smoothInput`, `wheelPixels`) and a small class that owns the passive listeners. Nothing is
 * allocated per frame, and an idle page costs two comparisons a frame.
 */
/** The time constant of the energy, in seconds. */
export const INPUT_TAU = 0.14;
/** A line of a `deltaMode: 1` wheel, in pixels (the smooth scroller uses the same). */
const LINE_PX = 16;
/** Below this speed (px/s) the energy is zero. */
const REST_PX_S = 0.5;
/** The keys that scroll a page. */
const SCROLL_KEYS = new Set([
  " ",
  "Spacebar",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  "ArrowUp",
  "ArrowDown",
]);

/** A wheel delta in pixels: `deltaMode` 0 is pixels, 1 is lines, 2 is pages. */
export function wheelPixels(delta: number, deltaMode: number, pageHeight: number): number {
  if (deltaMode === 1) return delta * LINE_PX;
  if (deltaMode === 2) return delta * Math.max(1, pageHeight);
  return delta;
}

/**
 * One step of the energy: the average of the rate `deltaPx / dt` over this frame, folded into the
 * previous value with the time constant `tau`. A frame with no input (`deltaPx` 0) decays it by
 * `exp(-dt / tau)`. `dt` of 0 or less changes nothing.
 */
export function smoothInput(prev: number, deltaPx: number, dt: number, tau = INPUT_TAU): number {
  if (!(dt > 0)) return prev;
  const k = 1 - Math.exp(-dt / tau);
  return prev + (deltaPx / dt - prev) * k;
}

/** The target of the listeners: a window, or any event target in a test. */
type Source = Pick<Window, "addEventListener" | "removeEventListener"> & {
  readonly innerHeight?: number;
};

export class InputEnergy {
  /** The one object every frame carries (`FrameInfo.input`), written in place. */
  readonly state: { wheel: number } = { wheel: 0 };
  /** Wall-clock milliseconds of the last wheel or touch (0: none yet). */
  pushAt = 0;
  /** Wall-clock milliseconds of the last scroll key (0: none yet). */
  keyAt = 0;
  /** Which way the last wheel or touch pushed the page: 1 down, -1 up. */
  pushDir: 1 | -1 = 1;
  private pending = 0;
  private touchY: number | null = null;
  private attached: Source | null = null;

  constructor(private readonly now: () => number = () => performance.now()) {}

  /** Wall-clock milliseconds of the last wheel, touch or scroll key. */
  get lastInputAt(): number {
    return Math.max(this.pushAt, this.keyAt);
  }

  /** A finger is on the screen. */
  get touching(): boolean {
    return this.touchY !== null;
  }

  /** The energy as a plain number (the same as `state.wheel`). */
  get wheel(): number {
    return this.state.wheel;
  }

  /** Start listening (passive, on the window). Does nothing when already attached. */
  attach(source: Source = window): void {
    if (this.attached) return;
    this.attached = source;
    source.addEventListener("wheel", this.onWheel, { passive: true });
    source.addEventListener("touchstart", this.onTouchStart, { passive: true });
    source.addEventListener("touchmove", this.onTouchMove, { passive: true });
    source.addEventListener("touchend", this.onTouchEnd, { passive: true });
    source.addEventListener("touchcancel", this.onTouchEnd, { passive: true });
    source.addEventListener("keydown", this.onKey, { passive: true });
  }

  detach(): void {
    const source = this.attached;
    if (!source) return;
    this.attached = null;
    source.removeEventListener("wheel", this.onWheel);
    source.removeEventListener("touchstart", this.onTouchStart);
    source.removeEventListener("touchmove", this.onTouchMove);
    source.removeEventListener("touchend", this.onTouchEnd);
    source.removeEventListener("touchcancel", this.onTouchEnd);
    source.removeEventListener("keydown", this.onKey);
  }

  /** Once a frame. `dt` is the frame's seconds (0 while the scene is frozen: nothing changes). */
  step(dt: number): void {
    if (!(dt > 0)) return;
    const s = this.state;
    if (this.pending === 0 && s.wheel === 0) return;
    const next = smoothInput(s.wheel, this.pending, dt);
    this.pending = 0;
    s.wheel = Math.abs(next) < REST_PX_S ? 0 : next;
  }

  /** Forget everything (a seek, the engine going). */
  reset(): void {
    this.pending = 0;
    this.state.wheel = 0;
    this.touchY = null;
  }

  private readonly onWheel = (e: WheelEvent): void => {
    this.pushAt = this.now();
    // A pinch zoom (ctrl) and a sideways push are not a scroll of the page.
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const h = this.attached?.innerHeight ?? 800;
    this.pending += wheelPixels(e.deltaY, e.deltaMode, h);
    if (e.deltaY !== 0) this.pushDir = e.deltaY > 0 ? 1 : -1;
  };

  private readonly onTouchStart = (e: TouchEvent): void => {
    this.pushAt = this.now();
    this.touchY = e.touches[0]?.clientY ?? null;
  };

  private readonly onTouchMove = (e: TouchEvent): void => {
    this.pushAt = this.now();
    const y = e.touches[0]?.clientY;
    if (y === undefined) return;
    // The finger going up is the page going down.
    if (this.touchY !== null) {
      this.pending += this.touchY - y;
      if (y !== this.touchY) this.pushDir = this.touchY - y > 0 ? 1 : -1;
    }
    this.touchY = y;
  };

  private readonly onTouchEnd = (): void => {
    this.pushAt = this.now();
    this.touchY = null;
  };

  private readonly onKey = (e: KeyboardEvent): void => {
    if (SCROLL_KEYS.has(e.key)) this.keyAt = this.now();
  };
}
