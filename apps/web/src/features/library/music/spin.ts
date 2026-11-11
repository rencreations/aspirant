/**
 * How a disc comes back to rest upright: the record's own turn after its track stops, the turn a
 * drag gave it, and the small disc of the player bar. Plain numbers, so it can be tested.
 *
 * A disc at rest shows its picture upright: its turn is a whole number of turns. When it stops
 * turning it does not stop where it happens to be. It goes on in the direction it was turning and
 * slows down to the next whole turn that it can reach gently, starting at the speed it had (no
 * jolt) and arriving with no speed. A disc that hardly turns goes to the nearest whole turn.
 *
 * The way there is one cubic curve in time (a Hermite curve that starts at the disc's speed and
 * ends at rest). The same curve is a CSS `cubic-bezier` easing (`restEasing`), so the player bar
 * runs it as a Web Animation.
 */

/** One whole turn, in radians. */
export const TURN = Math.PI * 2;

/** Below this speed (radians a second) a disc is not turning: it takes the nearest whole turn. */
const SLOW = 0.3;
/** The shortest and the longest way to rest, in seconds, for a disc that turns. */
const MIN_REST = 0.8;
const MAX_REST = 3.6;

export interface RestPlan {
  /** The angle it starts from (radians). */
  from: number;
  /** The whole turn it comes to rest on. */
  to: number;
  /** Its speed at the start, radians a second, with the sign of the direction it turns. */
  v0: number;
  /** Seconds. Zero when it is already at rest. */
  dur: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** The whole turn nearest to `angle` (0 for anything within half a turn of it). */
export function nearestTurn(angle: number): number {
  const turn = TURN * Math.round(angle / TURN);
  // `-0` would read as a turn left to make.
  return turn === 0 ? 0 : turn;
}

/** True when `angle` shows the picture upright (a whole number of turns). */
export function isUpright(angle: number, tolerance = 1e-6): boolean {
  return Math.abs(angle - nearestTurn(angle)) <= tolerance;
}

/**
 * Plan the way back to rest of a disc at `angle` that turns at `velocity` (radians a second, signed).
 *
 * A turning disc goes forward to the first whole turn it can reach in at least `MIN_REST` seconds
 * while slowing all the way (its speed falls as `1 - s²`, so it starts at its own speed with no
 * jolt). When that whole turn is far, the way is capped at `MAX_REST` seconds and the disc runs a
 * little quicker before it slows. It never turns back.
 */
export function planRest(angle: number, velocity: number): RestPlan {
  const speed = Math.abs(velocity);
  if (speed < SLOW) {
    const to = nearestTurn(angle);
    const d = Math.abs(to - angle);
    if (d < 1e-9) return { from: angle, to, v0: 0, dur: 0 };
    return { from: angle, to, v0: velocity, dur: clamp(0.6 + d * 0.35, 0.6, 1.6) };
  }
  const dir = Math.sign(velocity);
  // With the `1 - s²` slowdown a disc covers two thirds of `speed * time`.
  const least = (speed * MIN_REST * 2) / 3;
  const to =
    dir > 0 ? TURN * Math.ceil((angle + least) / TURN) : TURN * Math.floor((angle - least) / TURN);
  const d = Math.abs(to - angle);
  return { from: angle, to, v0: velocity, dur: clamp((1.5 * d) / speed, MIN_REST, MAX_REST) };
}

/** Where a disc is `t` seconds into its plan, how fast it turns, and whether it has arrived. */
export function restAt(
  plan: RestPlan,
  t: number,
): { angle: number; velocity: number; done: boolean } {
  if (plan.dur <= 0 || t >= plan.dur) return { angle: plan.to, velocity: 0, done: true };
  const s = clamp(t / plan.dur, 0, 1);
  const d = plan.to - plan.from;
  const m0 = plan.v0 * plan.dur;
  const angle = plan.from + m0 * (s * s * s - 2 * s * s + s) + d * (3 * s * s - 2 * s * s * s);
  const velocity = (m0 * (3 * s * s - 4 * s + 1) + d * (6 * s - 6 * s * s)) / plan.dur;
  return { angle, velocity, done: false };
}

/**
 * The plan as a CSS easing from `from` to `to` over `dur`: the same curve as `restAt` (the time
 * controls at a third and two thirds keep time linear, the first height sets the start speed).
 */
export function restEasing(plan: RestPlan): string {
  const d = plan.to - plan.from;
  if (plan.dur <= 0 || Math.abs(d) < 1e-9) return "linear";
  const y1 = (plan.v0 * plan.dur) / (3 * d);
  return `cubic-bezier(0.3333, ${y1.toFixed(4)}, 0.6667, 1)`;
}
