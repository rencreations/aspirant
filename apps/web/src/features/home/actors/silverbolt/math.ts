/** Small pure helpers of the Silverbolt actor: springs, easing, the pixel frame and the camera. */

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a || 1), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Frame rate independent ease of `current` toward `target`. `rate` is 1 / seconds. */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * Math.max(0, dt));
}

/**
 * Keep a value inside `+-limit` with no corner: it follows the input near zero and bends over to
 * the limit smoothly (tanh). Head follow uses it so a cursor behind the dragon does not snap it.
 */
export function softClamp(v: number, limit: number): number {
  if (limit <= 0) return 0;
  return limit * Math.tanh(v / limit);
}

export interface SpringState {
  x: number;
  v: number;
}

/**
 * A damped spring toward `target`, stepped in pieces of at most 1/120 s so that a long frame does
 * not blow it up. `omega` is the natural frequency in rad/s, `zeta` the damping ratio (1 is
 * critical). It never produces NaN for a `dt` of 0.
 */
export function springStep(
  s: SpringState,
  target: number,
  omega: number,
  zeta: number,
  dt: number,
) {
  if (!(dt > 0)) return;
  const steps = Math.max(1, Math.ceil(dt * 120));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    s.v += (omega * omega * (target - s.x) - 2 * zeta * omega * s.v) * h;
    s.x += s.v * h;
  }
}

/** Put a spring at rest at `x` (a jump must not leave it flying). */
export function springSnap(s: SpringState, x: number): void {
  s.x = x;
  s.v = 0;
}

/** The camera's side of the stage: a point at depth `z` appears at `camZ / (camZ - z)` times its size. */
export function perspectiveFactor(z: number, camZ: number): number {
  return camZ / Math.max(1e-3, camZ - z);
}

/** The nearest depth `place` accepts: the pass's near plane is 0.01 of the camera distance. */
export function clampDepth(z: number, camZ: number): number {
  return Math.min(z, camZ * 0.985);
}

/**
 * The world scale (units of the stage, which are pixels at z = 0, per metre of the model) that
 * makes the body block `bodyM` metres tall appear `heightPx` CSS pixels tall at depth `z`.
 */
export function scaleForHeight(heightPx: number, z: number, camZ: number, bodyM: number): number {
  return heightPx / (bodyM * perspectiveFactor(clampDepth(z, camZ), camZ));
}

/** Where a screen point of the picture plane (z = 0) is on the plane at depth `z`. */
export function unprojectToDepth(
  sx: number,
  sy: number,
  z: number,
  camZ: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  const t = (camZ - z) / camZ;
  out.x = sx * t;
  out.y = sy * t;
  return out;
}

/**
 * The yaw and pitch (radians) that turn the dragon's head, which faces +Z at 0, to point along a
 * heading drawn on the screen: `(hx, hy)` with x to the right and y up. `toward` is how far the
 * head is turned out of the screen plane toward the camera (0 is a profile, 1 is straight at the
 * lens). A top left flight is `facing(-1, 1, 0.35)`.
 *
 * `place({ yaw, pitch })` turns by yaw about Y first, then by pitch about the dragon's own X.
 */
export function facing(hx: number, hy: number, toward: number): { yaw: number; pitch: number } {
  const len = Math.hypot(hx, hy) || 1;
  const phi = clamp(toward, 0, 1) * (Math.PI / 2);
  const c = Math.cos(phi);
  const fx = (hx / len) * c;
  const fy = (hy / len) * c;
  const fz = Math.sin(phi);
  return { yaw: Math.atan2(fx, fz), pitch: Math.asin(clamp(fy, -1, 1)) };
}

/**
 * True when a clip's time moved by more than `limit` seconds between two frames (a scrub, a jump of
 * the scroll, another clip): the springs must snap then, they cannot follow a pose that did not
 * move continuously. A loop of length `duration` wraps, so the shorter way round counts.
 */
export function clipJumped(
  prev: number,
  next: number,
  duration: number,
  loops: boolean,
  limit = 0.3,
): boolean {
  let d = Math.abs(next - prev);
  if (loops && duration > 0) d = Math.min(d, duration - d);
  return d > limit;
}

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a: number): number {
  const t = (a + Math.PI) % (2 * Math.PI);
  return (t <= 0 ? t + 2 * Math.PI : t) - Math.PI;
}
