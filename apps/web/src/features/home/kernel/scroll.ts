/**
 * The scroll position as the scene sees it. The page scrolls natively (Lenis moves the window);
 * the kernel reads `scrollY` once per frame, converts it to screens, and runs it through a
 * critically damped spring whose lag is soft clamped, so a flight feels weighty but never late
 * (the way premotio's scene follows its scroll: omega 18, a knee and a ceiling on the lag).
 * Both the raw and the smoothed position are exposed. Pure arithmetic here, the DOM is read by
 * the engine.
 */

/** Spring stiffness of the scene's follow, in radians per second. */
export const SCENE_OMEGA = 18;
/** The lag (screens) that passes through unchanged. */
export const LAG_KNEE = 0.1;
/** The most the scene ever trails the real scroll, in screens. */
export const LAG_MAX = 0.2;
/** A single step bigger than this is a jump (a scrollbar drag, Back, a probe), not a scroll. */
export const JUMP_SCREENS = 1.5;

/** The exact solution of a critically damped spring over `dt` seconds. */
export function springStep(
  x: number,
  v: number,
  target: number,
  omega: number,
  dt: number,
): { x: number; v: number } {
  const d = x - target;
  const e = Math.exp(-omega * dt);
  const j = v + omega * d;
  return { x: target + (d + j * dt) * e, v: (v - omega * j * dt) * e };
}

/** Pass a lag through up to `knee`, then compress it smoothly to at most `max`. */
export function softLag(lag: number, knee = LAG_KNEE, max = LAG_MAX): number {
  const a = Math.abs(lag);
  if (a <= knee) return lag;
  const room = max - knee;
  return Math.sign(lag) * (knee + room * Math.tanh((a - knee) / room));
}

/** The state of the scene's follow of the scroll. All in screens. */
export class SceneScroll {
  /** The real position. */
  raw = 0;
  /** The position the scene is drawn at. */
  shown = 0;
  /** Screens per second. */
  velocity = 0;
  /** True when the last `step` was a jump (the first frame counts). */
  jumped = true;
  private primed = false;
  private spring = 0;
  private springV = 0;

  /**
   * Move to the new raw position. `dt` of 0 (a frozen scene) keeps the shown position where it is.
   * Returns true when this step was a jump.
   */
  step(raw: number, dt: number): boolean {
    if (!this.primed) {
      // The very first frame: start on the real position.
      this.primed = true;
      this.snap(raw);
      this.jumped = true;
      return true;
    }
    this.raw = raw;
    this.jumped = false;
    if (dt <= 0) return false;
    if (Math.abs(raw - this.shown) > JUMP_SCREENS) {
      this.snap(raw);
      this.jumped = true;
      return true;
    }
    const s = springStep(this.spring, this.springV, raw, SCENE_OMEGA, dt);
    this.spring = s.x;
    this.springV = s.v;
    const lag = softLag(raw - this.spring);
    const before = this.shown;
    this.shown = raw - lag;
    this.velocity = (this.shown - before) / dt;
    return false;
  }

  /** Put the scene on the real position at once (a probe, a jump, the first frame). */
  snap(raw: number): void {
    this.raw = raw;
    this.shown = raw;
    this.spring = raw;
    this.springV = 0;
    this.velocity = 0;
  }
}

/** Convert a scroll offset in pixels to screens, given the screen height (the large viewport). */
export function screensOf(scrollY: number, unit: number): number {
  return unit > 0 ? scrollY / unit : 0;
}

/**
 * How far the end of the page is below the bottom of the viewport, in screens, from the document
 * alone (so it works with no scene at all, and the same on a long page and a short one). Zero at the
 * very end, and infinite when the page has nothing to scroll. The way to About arms when this is below `ARM_WITHIN` of a screen.
 */
export function screensToEnd(
  scrollY: number,
  scrollHeight: number,
  viewportHeight: number,
): number {
  // A page with nothing to scroll has no end to reach.
  if (viewportHeight <= 0 || scrollHeight - viewportHeight <= 1) return Infinity;
  return Math.max(0, (scrollHeight - viewportHeight - scrollY) / viewportHeight);
}
