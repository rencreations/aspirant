/**
 * The pull at either end of a chapter: input that tries to go past the end of the page builds up,
 * shows, and starts the chapter morph once it is full. Pure: the caller passes the time.
 *
 * - Wheel: only deltas toward the edge count, and only once the page has rested at the edge for
 *   `restMs`, or a new gesture starts there (a gap of `gapMs` since the last wheel event), so the
 *   tail of the momentum that carried the page to its end does not count.
 * - Keys add a step each and hold longer before they decay.
 * - Touch: the distance of the finger past the end, against its own threshold.
 * - With no input for a while the pull drains at `decay` px a second.
 * - Once full it locks, so the momentum after it cannot start a second morph.
 */

export interface PullConfig {
  /** Pixels of wheel that fill the pull. */
  readonly threshold: number;
  /** The fraction at which the indicator shows. */
  readonly showAt: number;
  /** Drain, in pixels a second, once input has stopped. */
  readonly decay: number;
  /** Quiet time after wheel input before the pull drains. */
  readonly idleMs: number;
  /** Quiet time after a key before the pull drains. */
  readonly keyHoldMs: number;
  /** The page has been at the edge this long: the wheel counts. */
  readonly restMs: number;
  /** A gap this long between wheel events is a new gesture: the wheel counts at once. */
  readonly gapMs: number;
  /** The share of the pull one key press adds. */
  readonly keyStep: number;
  /** Pixels of finger travel past the end that fill the pull. */
  readonly touchThreshold: number;
}

export const PULL: PullConfig = {
  threshold: 650,
  showAt: 0.12,
  decay: 600,
  idleMs: 180,
  keyHoldMs: 700,
  restMs: 250,
  gapMs: 120,
  keyStep: 0.34,
  touchThreshold: 140,
};

export class PullMeter {
  private amount = 0;
  private locked = false;
  private armed = false;
  private touching = false;
  private edgeSince: number | null = null;
  private lastWheel = -Infinity;
  private lastInput = -Infinity;
  private hold: number;
  private lastTick = -Infinity;

  constructor(private readonly config: PullConfig = PULL) {
    this.hold = config.idleMs;
  }

  /** 0 to 1. */
  get progress(): number {
    return Math.min(1, this.amount / this.config.threshold);
  }

  /** The indicator is on. */
  get shown(): boolean {
    return !this.locked && this.progress >= this.config.showAt;
  }

  get isLocked(): boolean {
    return this.locked;
  }

  /** The page is, or is not, at the edge. Leaving it empties the pull. */
  edge(at: boolean, now: number): void {
    if (at) {
      this.edgeSince ??= now;
      return;
    }
    this.edgeSince = null;
    this.armed = false;
    this.touching = false;
    if (!this.locked) this.amount = 0;
  }

  /** A wheel delta, positive toward the edge. True when it fills the pull. */
  wheel(delta: number, now: number, atEdge: boolean): boolean {
    const gap = now - this.lastWheel;
    this.lastWheel = now;
    this.edge(atEdge, now);
    if (this.locked || !atEdge) return false;
    this.drain(now);
    if (delta <= 0) {
      this.amount = Math.max(0, this.amount + delta);
      return false;
    }
    if (!this.armed) {
      const rested = this.edgeSince !== null && now - this.edgeSince >= this.config.restMs;
      if (!rested && gap < this.config.gapMs) return false;
      this.armed = true;
    }
    return this.add(delta, now, this.config.idleMs);
  }

  /** A key that scrolls toward the edge (Space, Page Down, the arrow, End). */
  key(now: number, atEdge: boolean): boolean {
    this.edge(atEdge, now);
    if (this.locked || !atEdge) return false;
    this.drain(now);
    return this.add(this.config.threshold * this.config.keyStep, now, this.config.keyHoldMs);
  }

  /** The finger is `distance` pixels past the end (0 or more) while it is down. */
  touch(distance: number, now: number, atEdge: boolean): boolean {
    this.edge(atEdge, now);
    if (this.locked || !atEdge) return false;
    this.touching = true;
    this.lastInput = now;
    this.lastTick = now;
    const amount = (Math.max(0, distance) / this.config.touchThreshold) * this.config.threshold;
    return this.set(amount);
  }

  /** The finger has lifted: what is left drains. */
  release(now: number): void {
    if (!this.touching) return;
    this.touching = false;
    this.lastInput = now;
    this.lastTick = now;
    this.hold = this.config.idleMs;
  }

  /** Let time pass (drain). Returns the progress. */
  tick(now: number): number {
    this.drain(now);
    return this.progress;
  }

  /** Empty and open again (the morph did not happen). */
  reset(): void {
    this.amount = 0;
    this.locked = false;
    this.armed = false;
    this.touching = false;
  }

  private add(amount: number, now: number, hold: number): boolean {
    this.lastInput = now;
    this.lastTick = now;
    this.hold = hold;
    return this.set(this.amount + amount);
  }

  private set(amount: number): boolean {
    this.amount = Math.max(0, amount);
    if (this.amount < this.config.threshold) return false;
    this.amount = this.config.threshold;
    this.locked = true;
    return true;
  }

  private drain(now: number): void {
    if (this.locked || this.touching || this.amount <= 0) {
      this.lastTick = now;
      return;
    }
    const from = Math.max(this.lastTick, this.lastInput + this.hold);
    if (now > from)
      this.amount = Math.max(0, this.amount - (this.config.decay * (now - from)) / 1000);
    this.lastTick = now;
  }
}
