import type { FrameInfo } from "../kernel/types";

/** Turn the cast toward the path they are actually travelling. Formation changes use
 * distance so a paused scroll never carries a runner across the screen. */
export class ScrollTravel {
  private last = Number.NaN;
  private sign = 1;
  heading = 1;
  reverse = 0;

  reset(): void {
    this.last = Number.NaN;
  }

  update(frame: FrameInfo, fromBelow: boolean): void {
    const delta = frame.S - this.last;
    this.last = frame.S;
    if (!Number.isFinite(delta) || Math.abs(delta) > 1.2) {
      const direction = Number.isFinite(delta) ? delta : frame.velocity;
      this.sign = Math.abs(direction) > 0.001 ? Math.sign(direction) : fromBelow ? -1 : 1;
      this.heading = this.sign;
      this.reverse = this.sign < 0 ? 1 : 0;
      return;
    }
    if (Math.abs(delta) > 0.00001) this.sign = Math.sign(delta);
    this.heading += (this.sign - this.heading) * (1 - Math.exp(-frame.dt * 10));
    const goal = this.sign < 0 ? 1 : 0;
    this.reverse += (goal - this.reverse) * (1 - Math.exp(-Math.abs(delta) * 6.5));
  }

  /** The scroll is going back (the last move of the page was upward). */
  get backward(): boolean {
    return this.sign < 0;
  }

  /** The run already turns the hips by 0.62 radians. Supply only the remaining yaw. */
  runYaw(forward: 1 | -1): number {
    return forward * this.heading * 1.49 - 0.62;
  }
}
