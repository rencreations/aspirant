/**
 * Where Tetra is on the floor in the chase, as a small state machine (25 Nov 2026). Going down the
 * page she runs in behind the doll and Silverbolt and stops in the middle (`forwardX`). When the
 * scroll turns back, the pair turn round and run left, straight toward her. She does not turn with
 * them: she stops where she is, out of breath, and lets them pass her; when the tail has gone by she
 * runs after them (`behindX`, a place just behind the tail, which moves left with the pair). So
 * going back her place is the smaller of two numbers, `hold` (where she stopped) and `behindX`, mixed
 * smoothly so the change from waiting to running has no corner.
 *
 * Nothing here is allowed to be a jump. When the rule that gives her place changes (the scroll turns,
 * or turns again) the difference between where she was and where the new rule puts her is eased out
 * with a critically damped decay that keeps her speed (inertialization), so she slows into a stop,
 * or speeds into the chase, over a third of a second and never snaps. Pure: no DOM, no three.
 */

/** The slowest and the quickest her braking is (radians a second): about a third and a twentieth of a second. */
const OMEGA_MIN = 9;
const OMEGA_MAX = 30;
/** How much of her speed she skids on when she stops, in seconds (a little past where she was). */
const SKID_TIME = 0.07;

/** The smooth minimum of two numbers: the lower one, with its corner rounded over `k`. */
export function softMin(a: number, b: number, k: number): number {
  const d = a - b;
  return 0.5 * (a + b - Math.sqrt(d * d + k * k));
}

export interface TetraPathInput {
  /** Her place while the scroll goes down: the run, then the stand. */
  readonly forwardX: number;
  /** The place right behind the returning pair's tail (it moves left with them). */
  readonly behindX: number;
  /** The scroll goes back and the pair has begun to turn. */
  readonly backward: boolean;
  /** How wide the corner between waiting and running is, in pixels (also the longest skid). */
  readonly corner: number;
  readonly dt: number;
  /** The scene jumped (a scrollbar drag, a seek): she lands on her place, no easing. */
  readonly jumped: boolean;
}

export class TetraPath {
  /** Where she is. */
  x = 0;
  /** How fast she moves, pixels a second, signed. */
  speed = 0;
  /** She stands in the way of the pair and waits for them to pass. */
  waiting = false;

  /** Where she stopped when the scroll turned back (and where she stays until the tail has passed). */
  private hold = 0;
  /** Where she stopped when the scroll turned down again: she stays until her old place has come round. */
  private floor = -Infinity;
  private back = false;
  private primed = false;
  private offset = 0;
  private offsetSpeed = 0;
  private omega = OMEGA_MIN;
  private lastBehind = 0;
  private lastForward = 0;

  /** Forget everything: the next step lands on her place. */
  reset(): void {
    this.primed = false;
    this.floor = -Infinity;
  }

  step(input: TetraPathInput): number {
    const { forwardX, behindX, backward, corner, dt, jumped } = input;
    // Going down for the first time she just runs; `hold` follows her so that it is where she was the
    // moment the scroll turns.
    if (!backward) this.hold = this.x;
    if (!this.primed || jumped || !(dt > 0)) {
      this.primed = true;
      this.back = backward;
      this.offset = 0;
      this.offsetSpeed = 0;
      this.speed = 0;
      this.floor = -Infinity;
      this.lastBehind = behindX;
      this.lastForward = forwardX;
      this.hold = backward ? softMin(this.x, behindX, corner) : this.x;
      this.x = backward ? softMin(this.hold, behindX, corner) : forwardX;
      this.waiting = false;
      return this.x;
    }
    const switching = backward !== this.back;
    if (switching) {
      // She brakes in a short skid and stops a little past where she was (a stop that is a line, not
      // a bounce): the place she stops at is chosen so that the easing out has no overshoot.
      const skid = Math.max(-corner, Math.min(corner, this.speed * SKID_TIME));
      this.omega =
        skid === 0 ? OMEGA_MIN : Math.min(OMEGA_MAX, Math.max(OMEGA_MIN, this.speed / skid));
      const stopAt = this.x + this.speed / this.omega;
      if (backward) {
        // `hold` is chosen so that the rounded corner of the minimum puts her exactly on `stopAt`.
        const gap = behindX - stopAt;
        this.hold = gap > corner * 0.25 ? stopAt + (corner * corner) / (4 * gap) : stopAt;
      } else {
        this.floor = stopAt;
      }
    }
    const goBack = softMin(this.hold, behindX, corner);
    const goForward = Math.max(this.floor, forwardX);
    const target = backward ? goBack : goForward;
    this.waiting = backward
      ? behindX > this.hold - corner * 0.5
      : forwardX < this.floor + corner * 0.5;
    if (switching) {
      // Keep the place and the speed she has; the new rule's own speed is nothing while she waits.
      const free = backward ? behindX < this.hold - corner : forwardX > this.floor + corner;
      const ruleSpeed = free
        ? (backward ? behindX - this.lastBehind : forwardX - this.lastForward) / dt
        : 0;
      this.back = backward;
      this.offset = this.x - target;
      this.offsetSpeed = this.speed - ruleSpeed;
    } else {
      const k = this.offsetSpeed + this.omega * this.offset;
      const e = Math.exp(-this.omega * dt);
      this.offset = (this.offset + k * dt) * e;
      this.offsetSpeed = (this.offsetSpeed - this.omega * k * dt) * e;
    }
    const before = this.x;
    this.x = target + this.offset;
    this.speed = (this.x - before) / dt;
    this.lastBehind = behindX;
    this.lastForward = forwardX;
    return this.x;
  }
}
