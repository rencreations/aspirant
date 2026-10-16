/** Small, allocation-free maths helpers for animation loops. */

/** Clamp `v` into [min, max]. */
export function clamp(v: number, min = 0, max = 1): number {
  return v < min ? min : v > max ? max : v;
}

/** Linear interpolation from `a` to `b` by `t` (not clamped). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Frame-rate independent smoothing toward a target.
 * `lambda` is the response rate (higher is snappier, about 4 to 20), `dt` is in seconds.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Map `v` from [inMin, inMax] to [outMin, outMax]. Clamped unless `clampOutput` is false. */
export function map(
  v: number,
  inMin: number,
  inMax: number,
  outMin = 0,
  outMax = 1,
  clampOutput = true,
): number {
  if (inMax === inMin) return outMin;
  const t = (v - inMin) / (inMax - inMin);
  return lerp(outMin, outMax, clampOutput ? clamp(t) : t);
}

/** Hermite smoothstep between two edges. */
export function smoothstep(edge0: number, edge1: number, v: number): number {
  const t = clamp((v - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Wrap an index into [0, length). Works for negative numbers. */
export function wrap(index: number, length: number): number {
  return ((index % length) + length) % length;
}

/** Seeded PRNG (mulberry32). Returns a function giving floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
