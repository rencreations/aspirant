/**
 * Smoothing for the pair, pure (round nine, 20 Nov 2026). A scroll can move the dance's phase or the
 * route's progress by several screens in a few frames. Nothing the pair shows may follow that step by
 * step: an angle that turns by radians in one frame reads as a glitch, and so does a bounce that
 * runs at the frame rate. These helpers make a value follow its target with a limit on how fast it
 * can move, and make an angle follow its target by the SHORT way, as one continuous number (so a
 * spin that ends or a wrap of the angle never unwinds a whole turn).
 */

const TAU = Math.PI * 2;

/** `a` as the same turn in (-pi, pi]. */
export function wrapPi(a: number): number {
  return a - Math.round(a / TAU) * TAU;
}

/** The angle equal to `target` that lies nearest to `from` (it may be more than a turn away from `target`). */
export function nearestAngle(from: number, target: number): number {
  return from + wrapPi(target - from);
}

/** A value and its speed. */
export interface Damped {
  x: number;
  v: number;
}

/**
 * One step of a critically damped follow of `target` with a limit on the speed (units a second).
 * It never overshoots and is stable at any frame length (the exact family of the usual smooth damp).
 * `time` is about how long it takes to close most of a gap; the limit makes a long gap close at
 * `maxSpeed` instead.
 */
export function dampTo(
  s: Damped,
  target: number,
  time: number,
  maxSpeed: number,
  dt: number,
): number {
  if (dt <= 0) return s.x;
  const t = Math.max(0.0001, time);
  const omega = 2 / t;
  const k = omega * dt;
  const e = 1 / (1 + k + 0.48 * k * k + 0.235 * k * k * k);
  const maxChange = maxSpeed * t;
  const change = Math.max(-maxChange, Math.min(maxChange, s.x - target));
  const goal = s.x - change;
  const temp = (s.v + omega * change) * dt;
  s.v = (s.v - omega * temp) * e;
  let out = goal + (change + temp) * e;
  // Never run past the target.
  if (target - s.x > 0 === out > target) {
    out = target;
    s.v = 0;
  }
  s.x = out;
  return out;
}

/**
 * An angle that follows `target` (any turn of it) by the shortest way, as a continuous number, with
 * a limit on the angular speed. `s.x` is kept as an unbounded angle; the caller draws it as it is (the
 * rotation does not care about the turns). Returns `s.x`.
 */
export function dampAngle(
  s: Damped,
  target: number,
  time: number,
  maxSpeed: number,
  dt: number,
): number {
  return dampTo(s, nearestAngle(s.x, target), time, maxSpeed, dt);
}

/** Put a follower on a value at rest. */
export function setDamped(s: Damped, x: number): void {
  s.x = x;
  s.v = 0;
}
