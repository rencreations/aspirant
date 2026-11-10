/**
 * Turns wheel events into steps of the disc field: one notch of a mouse wheel is one disc, a
 * flick on a trackpad is one disc (not ten), and a long, steady swipe keeps stepping at a calm
 * pace. Plain logic with the time passed in, so it can be tested.
 *
 * How it decides:
 *  - Each event adds its size to a count; the count reaching `threshold` makes a step.
 *  - After a step the stepper is closed. It opens again on one of four signs: a pause in the
 *    events (`pauseGap`), a separate notch of a mouse wheel (`tickGap` after the last event and
 *    `minTick` after the step), a new push that is stronger than what is left of the last one
 *    (`minFlick` after the step), or a long swipe that keeps its strength (`sustain`).
 *  - What is left of a push fades with time (`fade`), so the tail of a trackpad's momentum does
 *    not count as a new push.
 */
export interface WheelOptions {
  /** Sizes under this are noise. */
  floor: number;
  /** The count that makes a step. */
  threshold: number;
  /** One event never counts for more than this. */
  cap: number;
  /** The time over which a push fades, in ms. */
  fade: number;
  /** A push is new when it is this much stronger than what is left of the last one. */
  rise: number;
  tickGap: number;
  pauseGap: number;
  /** After this long without an event, the stepper starts fresh. */
  idle: number;
  minTick: number;
  minFlick: number;
  sustain: number;
  /** A sustained swipe keeps stepping while it holds this share of its strongest event. */
  sustainShare: number;
}

const WHEEL: WheelOptions = {
  floor: 0.3,
  threshold: 6,
  cap: 24,
  fade: 550,
  rise: 1.2,
  tickGap: 34,
  pauseGap: 130,
  idle: 150,
  minTick: 90,
  minFlick: 190,
  sustain: 480,
  sustainShare: 0.8,
};

/** The main delta of a wheel event, in pixels (lines and pages are converted). */
export function wheelDelta(
  e: {
    deltaX: number;
    deltaY: number;
    deltaMode: number;
  },
  viewport: { width: number; height: number },
): number {
  let x = e.deltaX;
  let y = e.deltaY;
  if (e.deltaMode === 1) {
    x *= 16;
    y *= 16;
  } else if (e.deltaMode === 2) {
    x *= viewport.width;
    y *= viewport.height;
  }
  return Math.abs(x) > Math.abs(y) * 1.25 ? x : y;
}

export class WheelSteps {
  private readonly o: WheelOptions;
  private open = true;
  /** Only the part of each event above what is left of the last push counts (a flick). */
  private excessOnly = false;
  private count = 0;
  private dir = 0;
  /** What is left of the push, fading with time. */
  private envelope = 0;
  private lastAt = -Infinity;
  private stepAt = 0;
  private eventsSinceStep = 0;
  private strongest = 0;

  constructor(options: Partial<WheelOptions> = {}) {
    this.o = { ...WHEEL, ...options };
  }

  reset(): void {
    this.open = true;
    this.excessOnly = false;
    this.count = 0;
    this.dir = 0;
    this.envelope = 0;
    this.lastAt = -Infinity;
    this.stepAt = 0;
    this.eventsSinceStep = 0;
    this.strongest = 0;
  }

  /** Feed one event. Returns the step it makes: 1, -1 or 0. */
  push(delta: number, now: number): -1 | 0 | 1 {
    const o = this.o;
    if (now - this.lastAt > o.idle) this.reset();
    const gap = Number.isFinite(this.lastAt) ? now - this.lastAt : Infinity;
    this.lastAt = now;
    const size = Math.abs(delta);
    const left = Number.isFinite(gap) ? this.envelope * Math.exp(-gap / o.fade) : 0;
    if (size < o.floor) {
      this.envelope = left;
      return 0;
    }
    const rising = size > left * o.rise;
    this.envelope = Math.max(size, left);

    if (!this.open) {
      this.eventsSinceStep += 1;
      this.strongest = Math.max(this.strongest, size);
      const sinceStep = now - this.stepAt;
      const paused = gap >= o.pauseGap;
      const notch =
        gap >= o.tickGap &&
        this.eventsSinceStep <= 2 &&
        sinceStep >= o.minTick &&
        size >= this.strongest;
      const flick = rising && sinceStep >= o.minFlick;
      const held = sinceStep >= o.sustain && this.envelope >= this.strongest * o.sustainShare;
      if (!(paused || notch || flick || held)) return 0;
      this.open = true;
      this.count = 0;
      this.dir = 0;
      this.excessOnly = !(paused || notch || held);
    }

    const dir = delta > 0 ? 1 : -1;
    if (dir !== this.dir) {
      this.count = 0;
      this.dir = dir;
    }
    const counted = this.excessOnly ? Math.max(0, size - left) : size;
    this.count += Math.min(counted, o.cap);
    if (this.count < o.threshold) return 0;

    this.open = false;
    this.excessOnly = false;
    this.count = 0;
    this.stepAt = now;
    this.eventsSinceStep = 0;
    this.strongest = size;
    return dir;
  }
}
