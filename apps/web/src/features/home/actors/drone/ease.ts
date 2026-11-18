/**
 * The curves and the small springs the drone's motion is made of. Pure arithmetic, no DOM and no
 * three, so every part of the motion can be tested. Taken from the About page's `choreo/ease.ts`
 * (the home does not import from `features/about` but for constants).
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

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeInOutSine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));

/** A turn that leans back a little before it goes and runs a little past before it settles. */
export function easeTurn(t: number): number {
  const v = clamp01(t);
  return easeInOutCubic(v) - 0.045 * Math.sin(TAU * v);
}

/** 0 at both ends, 1 in the middle. */
export const bump = (t: number) => Math.sin(Math.PI * clamp01(t));

/** Rises past 1 and settles on it: a pop. `overshoot` is how far past. */
export function easeOutBack(t: number, overshoot = 1.70158): number {
  const v = clamp01(t) - 1;
  return 1 + (overshoot + 1) * v * v * v + overshoot * v * v;
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
 * One step of a loose spring (it swings past and comes back): `zeta` under 1 is how little it is
 * damped. Stepped in small slices so a long frame cannot blow it up.
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
