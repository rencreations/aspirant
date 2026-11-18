/**
 * Small damped springs and filters for the live motion of the cards. Plain numbers, no three.js.
 * Springs run in fixed sub-steps of 1/120 s (premotio's own step), so a slow frame or a fast one
 * gives the same motion, and a long pause is never a long jump.
 */
export interface Spring {
  x: number;
  v: number;
}

export const makeSpring = (x = 0): Spring => ({ x, v: 0 });

const STEP = 1 / 120;
const MAX_STEPS = 24;

/**
 * Move a spring toward `target`: angular speed `omega` (rad/s) and damping ratio `zeta`. `accel`
 * is a force pushing on it all the while (the pointer's push).
 */
export function springStep(
  s: Spring,
  target: number,
  omega: number,
  zeta: number,
  dt: number,
  accel = 0,
): void {
  if (!(dt > 0)) return;
  const steps = Math.min(MAX_STEPS, Math.max(1, Math.ceil(dt / STEP)));
  const h = Math.min(dt, MAX_STEPS * STEP) / steps;
  const k = omega * omega;
  const c = 2 * zeta * omega;
  for (let i = 0; i < steps; i++) {
    s.v += (k * (target - s.x) - c * s.v + accel) * h;
    s.x += s.v * h;
  }
}

/** Put a spring at rest on `x`. */
export function springSnap(s: Spring, x: number): void {
  s.x = x;
  s.v = 0;
}

/** The share to move toward a target in `dt` for a low-pass of `rate` per second: `1 - exp(-rate dt)`. */
export function lowpassGain(rate: number, dt: number): number {
  return dt > 0 ? 1 - Math.exp(-rate * dt) : 0;
}

/** `limit * tanh(x / limit)`: x passes through near zero and never goes past `limit`. */
export function softClamp(x: number, limit: number): number {
  return limit * Math.tanh(x / limit);
}
