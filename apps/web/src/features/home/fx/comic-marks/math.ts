/**
 * The small pure functions the marks and the trails share: easing, a seeded hash (no
 * `Math.random`, so a frame sheet is the same every time), the conversion from normalised device
 * coordinates to the stage's pixel frame. Nothing here imports three.
 */

export const TAU = Math.PI * 2;

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function easeInQuad(x: number): number {
  const u = clamp01(x);
  return u * u;
}

/**
 * Ease out with an overshoot: 0 at 0, 1 at 1, and a peak of about `1 + 0.1 * s` on the way
 * (`s` 1.7 is the classic back ease). `s` 0 is a plain cubic ease out.
 */
export function easeOutBack(x: number, s = 1.70158): number {
  const t = clamp01(x) - 1;
  return 1 + t * t * ((s + 1) * t + s);
}

/**
 * A 32 bit integer hash of two integers, as a float in [0, 1). A seed and an index give one number
 * that never changes, with no state to carry and nothing allocated.
 */
export function hash01(seed: number, k: number): number {
  let h =
    Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((k | 0) + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** A hash number in [lo, hi). */
export function hashRange(seed: number, k: number, lo: number, hi: number): number {
  return lo + (hi - lo) * hash01(seed, k);
}

/** A hash number in [-1, 1). */
export function hashSigned(seed: number, k: number): number {
  return hash01(seed, k) * 2 - 1;
}

/**
 * Normalised device coordinates (-1 to 1, y up) to the stage's pixel frame: the origin is the
 * middle of the screen, x goes right, y goes up, one unit is one CSS pixel.
 */
export function ndcToPixels(
  nx: number,
  ny: number,
  w: number,
  h: number,
  out: { x: number; y: number },
): void {
  out.x = (nx * w) / 2;
  out.y = (ny * h) / 2;
}

/**
 * Client pixels (origin top left, y down: a pointer, a DOM rectangle) to the stage's pixel frame
 * (origin in the middle, y up).
 */
export function clientToStage(
  cx: number,
  cy: number,
  w: number,
  h: number,
  out: { x: number; y: number },
): void {
  out.x = cx - w / 2;
  out.y = h / 2 - cy;
}

/**
 * The shape of one mark's life: how big it is (with the squash of its pop), and how opaque.
 * `age` and `life` are seconds. A held mark never fades. The pop is a short ease out with an
 * overshoot (`overshoot` 0 is none), the squash is a stretch tall then wide that settles to
 * nothing, the fade is the last `fadeT` seconds.
 */
export interface EnvelopeParams {
  popT: number;
  fadeT: number;
  overshoot: number;
  squash: number;
  held: boolean;
}

export interface Envelope {
  scale: number;
  /** Positive is wide and low, negative is narrow and tall. */
  squash: number;
  alpha: number;
}

export function envelopeAt(age: number, life: number, p: EnvelopeParams, out: Envelope): void {
  let scale = 1;
  let squash = 0;
  if (p.popT > 0 && age < p.popT) {
    const x = clamp01(age / p.popT);
    scale = easeOutBack(x, p.overshoot);
    // Tall at the start, wide at the bottom of the pop, then still.
    squash = -p.squash * (1 - x) * Math.cos(x * Math.PI * 2.2);
  }
  let alpha = 1;
  if (!p.held && p.fadeT > 0 && age > life - p.fadeT) {
    const f = clamp01((age - (life - p.fadeT)) / p.fadeT);
    alpha = 1 - easeInQuad(f);
    scale *= 1 - 0.12 * f;
  }
  if (age < 0) alpha = 0;
  out.scale = scale;
  out.squash = squash;
  out.alpha = alpha;
}
