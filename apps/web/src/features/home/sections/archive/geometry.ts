/**
 * Where the ten covers of the archive stand, and how the strip they are on moves. Pure: numbers in,
 * numbers out, no DOM and no three.js. The strip is one row of squares. While the drone tours the
 * rooms it hovers over the lit cover, and the covers slide under it: the drone goes along the screen
 * by `1 - k` of a pitch per room, the strip goes the other way by `k` of a pitch, so both are seen
 * moving and the drone is exactly over the cover it lights.
 *
 * Screen frame here: pixels, the origin at the top left, y down (the DOM's). The route converts to
 * the stage frame of the actors where it places them.
 */

/** The ten rooms of the collection. */
export const ROOMS = 10;
/** Steps of the tour: from the first cover to the last. */
export const STEPS = ROOMS - 1;

export interface StripGeo {
  readonly w: number;
  readonly h: number;
  /** The side of a cover. */
  readonly s: number;
  /** Distance between the middles of two covers. */
  readonly pitch: number;
  /** Screen x of the middle of cover 0 at tour position 0, and of the drone over it. */
  readonly x0: number;
  /** Screen x of the drone over the last cover. */
  readonly x1: number;
  /** Screen y of the middle of the covers. */
  readonly yc: number;
  /** Screen y of the top of a cover. */
  readonly top: number;
  /** Screen y of the middle of the drone while it hovers, and its height. */
  readonly droneY: number;
  readonly droneH: number;
  /** The share of a pitch the strip slides per room (the drone goes the rest). */
  readonly k: number;
}

/** The gap between the foot of the drone and the top of a cover, in screen heights. */
const GAP = 0.07;

/** Make the geometry for a viewport. Called when the size changes, never per frame. */
export function stripGeo(w: number, h: number): StripGeo {
  const portrait = w < 0.8 * h;
  const s = portrait ? Math.min(0.58 * w, 0.34 * h) : Math.min(0.32 * h, 0.21 * w);
  const pitch = 1.22 * s;
  const x0 = (portrait ? 0.4 : 0.2) * w;
  const x1 = (portrait ? 0.6 : 0.8) * w;
  const yc = 0.585 * h;
  const top = yc - s / 2;
  const droneH = 0.13 * h;
  const droneY = top - GAP * h - droneH / 2;
  const k = 1 - (x1 - x0) / (STEPS * pitch);
  return { w, h, s, pitch, x0, x1, yc, top, droneY, droneH, k };
}

/** Screen x of the middle of cover `q` (a fraction is a point between two) when the tour is at `p`. */
export function coverX(g: StripGeo, q: number, p: number): number {
  return g.x0 + (q - g.k * p) * g.pitch;
}

/** How far the strip is slid at tour position `p` (px, to the left). */
export function stripSlide(g: StripGeo, p: number): number {
  return g.k * p * g.pitch;
}

const smooth = (u: number): number => u * u * (3 - 2 * u);
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** The share of a step the drone rests on a cover before it goes to the next. */
export const DWELL = 0.55;

/**
 * The tour position (0 to 9) for the progress `u` (0 to 1): the drone rests over each cover for
 * `DWELL` of its step and glides to the next over the rest. Continuous, monotone, 0 at 0 and 9 at 1.
 */
export function tourP(u: number): number {
  const x = clamp01(u) * STEPS;
  if (x >= STEPS) return STEPS;
  const i = Math.floor(x);
  const f = x - i;
  return i + smooth(clamp01((f - DWELL) / (1 - DWELL)));
}

/** The progress `u` at which the drone rests over cover `i` (the middle of its dwell). */
export function restU(i: number): number {
  return i >= STEPS ? 1 : (i + DWELL / 2) / STEPS;
}

/**
 * How lit cover `i` is when the light is at `q` (a fraction of a cover index): 1 when the light is
 * on it, falling to 0 a little before the next one, so two covers share the light while it moves.
 */
export function lit(q: number, i: number): number {
  return smooth(clamp01(1 - 1.5 * Math.abs(q - i)));
}

/** The index of the cover nearest to the light. */
export function nearest(q: number): number {
  return Math.min(STEPS, Math.max(0, Math.round(q)));
}
