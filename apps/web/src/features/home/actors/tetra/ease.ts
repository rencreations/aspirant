/**
 * The curves and small springs Tetra's motion is made of. Pure arithmetic, no DOM and no three, so
 * every part can be tested. The same functions as the drone's `ease.ts` (the home imports from
 * `features/about` only for constants and her spring solver).
 */

export const TAU = Math.PI * 2;

export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
export const clamp01 = (v: number) => clamp(v, 0, 1);

/** 0 below `a`, 1 above `b`, a soft S between. */
export function ramp(a: number, b: number, v: number): number {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
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
 * A small deterministic random (mulberry32), so a blink schedule or a wind is the same on every
 * run of a test and the same on every visit.
 */
export function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
