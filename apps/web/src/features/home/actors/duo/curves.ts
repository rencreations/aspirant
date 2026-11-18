import { bump, clamp01 } from "@/features/about/choreo/ease";

/**
 * The small curves every move of the duo is made of. Plain arithmetic.
 */

export type Ease = "io" | "out" | "in" | "back" | "lin";

export const EASE: Record<Ease, (u: number) => number> = {
  io: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  out: (u) => 1 - Math.pow(1 - u, 3),
  in: (u) => u * u * u,
  back: (u) => 1 + 2.70158 * Math.pow(u - 1, 3) + 1.70158 * Math.pow(u - 1, 2),
  lin: (u) => u,
};

/** 0 before `a`, 1 after `b`. */
export const span = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));

/** 0, up to 1 in the middle of [a, b], 0 again. */
export const hump = (t: number, a: number, b: number): number =>
  t <= a || t >= b ? 0 : bump((t - a) / (b - a));

/** A steady pseudo random number in [0, 1) for a whole number: the same every run. */
export function rand01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** A small generator with a seed, so the blinks of a probe's run are the same every time. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** True in the frame in which the clock crosses `offset + k * period` for some whole k. */
export function crossed(t: number, dt: number, period: number, offset = 0): boolean {
  if (dt <= 0) return false;
  // A tiny bias, so a clock that lands on a beat (8.0000000001 in one frame, 7.9999999999 in the
  // sum of the frame before) is on the same side of it both times and the beat fires once.
  const now = Math.floor((t - offset) / period + 1e-9);
  const was = Math.floor((t - dt - offset) / period + 1e-9);
  return now !== was && t - offset >= -1e-9;
}

export type Key = readonly [time: number, value: number, ease?: Ease];

/** A value through keys. Each key's curve is how the value comes to it from the key before. */
export function key(t: number, keys: readonly Key[]): number {
  let from = keys[0];
  if (!from) return 0;
  if (t <= from[0]) return from[1];
  for (let k = 1; k < keys.length; k += 1) {
    const to = keys[k];
    if (!to) break;
    if (t < to[0]) {
      const u = (t - from[0]) / (to[0] - from[0]);
      return from[1] + (to[1] - from[1]) * EASE[to[2] ?? "io"](u);
    }
    from = to;
  }
  return from[1];
}
