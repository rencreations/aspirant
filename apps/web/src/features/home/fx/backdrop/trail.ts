/**
 * The ripples the pointer leaves behind, for the kinds that draw them (`ink-field`). A ring of ten
 * slots, each one a point of the screen (0..1 from the left and from the bottom), its age in seconds
 * and a strength. A move of the pointer far enough from the last ripple, and not sooner than a short
 * gap, leaves a new one; a press leaves a stronger one, even from a finger that never hovered. A
 * ripple past its life has no strength and the shader skips it. Pure and allocation free: `data` is
 * the array the shader reads, laid out as x, y, age, strength for each slot.
 */

export const TRAIL_LEN = 10;
/** Seconds a ripple lives. */
export const TRAIL_LIFE = 2.6;
/** The pointer must go this far (0..1 units) from the last ripple for a new one. */
export const TRAIL_MOVE = 0.035;
/** The least time between two ripples of a move, seconds. */
export const TRAIL_GAP = 0.05;
const MOVE_STRENGTH = [0.35, 0.8] as const;
export const PRESS_STRENGTH = 1.5;

export class PointerTrail {
  readonly data = new Float32Array(TRAIL_LEN * 4);
  private head = 0;
  private lastX = Number.NaN;
  private lastY = Number.NaN;
  private since = Infinity;
  private wasDown = false;

  /** Age the ripples by `dt`, then leave a new one if the pointer moved far enough or was pressed. */
  step(dt: number, x: number, y: number, inside: boolean, down: boolean): void {
    const step = Math.max(0, dt);
    this.since += step;
    const d = this.data;
    for (let i = 0; i < TRAIL_LEN; i++) {
      const at = i * 4;
      if (d[at + 3]! <= 0) continue;
      d[at + 2] = d[at + 2]! + step;
      if (d[at + 2]! >= TRAIL_LIFE) d[at + 3] = 0;
    }
    if (down && !this.wasDown) {
      this.spawn(x, y, PRESS_STRENGTH);
      this.lastX = x;
      this.lastY = y;
    } else if (inside) {
      if (Number.isNaN(this.lastX)) {
        this.lastX = x;
        this.lastY = y;
      } else {
        const moved = Math.hypot(x - this.lastX, y - this.lastY);
        if (moved >= TRAIL_MOVE && this.since >= TRAIL_GAP) {
          const k = Math.min(1, (moved - TRAIL_MOVE) / 0.1);
          this.spawn(x, y, MOVE_STRENGTH[0] + (MOVE_STRENGTH[1] - MOVE_STRENGTH[0]) * k);
          this.lastX = x;
          this.lastY = y;
        }
      }
    } else {
      this.lastX = Number.NaN;
      this.lastY = Number.NaN;
    }
    this.wasDown = down;
  }

  /** How many ripples are alive. */
  get alive(): number {
    let n = 0;
    for (let i = 0; i < TRAIL_LEN; i++) if (this.data[i * 4 + 3]! > 0) n += 1;
    return n;
  }

  /** Forget every ripple (a jump of the page, a snap). */
  clear(): void {
    this.data.fill(0);
    this.lastX = Number.NaN;
    this.lastY = Number.NaN;
    this.since = Infinity;
  }

  private spawn(x: number, y: number, strength: number): void {
    const at = this.head * 4;
    this.data[at] = x;
    this.data[at + 1] = y;
    this.data[at + 2] = 0;
    this.data[at + 3] = strength;
    this.head = (this.head + 1) % TRAIL_LEN;
    this.since = 0;
  }
}
