/**
 * The curves and the small springs the drone's motion is made of. Pure arithmetic, no DOM and no
 * three, so every part of the flight can be tested.
 */

export const TAU = Math.PI * 2;

export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** 0 below `a`, 1 above `b`, a soft S between. */
export function ramp(a: number, b: number, v: number): number {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeInOutSine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));
export const easeOutQuad = (t: number) => 1 - (1 - clamp01(t)) * (1 - clamp01(t));

/** A turn that leans back a little before it goes and runs a little past before it settles. */
export function easeTurn(t: number): number {
  const v = clamp01(t);
  const s = easeInOutCubic(v);
  return s - 0.045 * Math.sin(TAU * v);
}

/** 0 at both ends, 1 in the middle. */
export const bump = (t: number) => Math.sin(Math.PI * clamp01(t));

/** A point on a cubic Bezier curve. */
export function bezier(p0: number, c1: number, c2: number, p1: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * p1;
}

/**
 * A cubic Hermite piece: from `p0` with speed `v0` to `p1` with speed `v1` over `span` seconds,
 * at the fraction `t`. Pieces that share a speed at a joint make one line with no corner in it.
 */
export function hermite(
  p0: number,
  v0: number,
  p1: number,
  v1: number,
  span: number,
  t: number,
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * p0 +
    (t3 - 2 * t2 + t) * span * v0 +
    (-2 * t3 + 3 * t2) * p1 +
    (t3 - t2) * span * v1
  );
}

/** A value with its speed. */
export interface Sprung {
  x: number;
  v: number;
}

/**
 * One step of a critically damped spring toward `target` (the exact solution, so it is the same
 * at any frame rate and never overshoots). `omega` is how quick it is, in radians per second.
 */
export function springTo(s: Sprung, target: number, omega: number, dt: number): void {
  const d = s.x - target;
  const e = Math.exp(-omega * dt);
  const k = (s.v + omega * d) * dt;
  s.x = target + (d + k) * e;
  s.v = (s.v - omega * k) * e;
}

/**
 * One step of a loose spring (it swings past and comes back). Used for the parts that trail the
 * body: `zeta` under 1 is how little it is damped. Stepped in small slices so a long frame cannot
 * blow it up.
 */
export function swingTo(s: Sprung, target: number, omega: number, zeta: number, dt: number): void {
  const steps = Math.max(1, Math.ceil(dt / 0.008));
  const h = dt / steps;
  for (let i = 0; i < steps; i += 1) {
    const a = -omega * omega * (s.x - target) - 2 * zeta * omega * s.v;
    s.v += a * h;
    s.x += s.v * h;
  }
}
