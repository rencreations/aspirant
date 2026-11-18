/**
 * The rows (screens 5.8 to 8.2): the angled rows of the picture field slide left under the scroll, a
 * small angled film appears in a gap of the middle row and rides it to the middle, the rest of the
 * cards leave from the film outward, and the film turns upright into the strip (joint J3). Pure
 * functions of `s`, the scroll in screens from the start of the section, so a jump lands exactly and
 * the strip (which runs in the rows' tail) agrees at the joint. Distances are in pitches of the
 * rows: one pitch is a card and its gap along a row, so they scale with the screen.
 */
import { clamp, ramp, smootherstep } from "../../fx/image-field/math";

/** Where the section starts on the scroll and how long it is (the registry's numbers, `journey.test.ts` keeps them equal). */
export const ROWS_START = 5.8;
export const ROWS_SCREENS = 2.4;

/** The beats, in screens from the start of the section. */
export const ROWS_BEATS = {
  /** The rows slide until here and come to rest. */
  slide: [0, 1.5],
  /** The angled film appears in a gap of the middle row. */
  appear: [0.62, 1.0],
  /** The clearing grows from the film outward: every other card leaves. */
  clear: [1.1, 1.8],
  /** The film turns from angled to upright (done at the end of the section: J3). */
  morph: [1.8, 2.4],
} as const;

/** How far the rows slide in all, in pitches. A whole number, so a gap of the middle row ends at the middle. */
export const MIN_SLIDE_PITCHES = 2;

/** 0 to 1: how far the rows have slid (still before the section starts, and once they have come to rest). */
export function slideProgress(s: number): number {
  const [a, b] = ROWS_BEATS.slide;
  return smootherstep(ramp(s, a, b));
}

/**
 * How far the rows slide in all, in the rows plane's pixels, when they stand at `phase` (their slide
 * at the start of the section, in the same pixels) and a card and its gap are `pitch` apart. It is
 * the least that is `MIN_SLIDE_PITCHES` long and ends on a whole number of pitches of slide, so the
 * gap of the middle row that the film rides is at the middle of the screen when the rows rest.
 */
export function slideTravel(phase: number, pitch: number): number {
  return Math.ceil((phase + MIN_SLIDE_PITCHES * pitch) / pitch) * pitch - phase;
}

/**
 * Where the film is along the middle row at `s`, as a share of the whole slide: 1 at the start (the
 * gap it rides, as far right as the slide is long), 0 at the end (the middle of the screen). It rides
 * a gap, so it moves with the cards and stops with them.
 */
export function filmAlong(s: number): number {
  return 1 - slideProgress(s);
}

/** 0 to 1: the angled film appears. */
export function appearAt(s: number): number {
  const [a, b] = ROWS_BEATS.appear;
  return ramp(s, a, b);
}

/** 0 to 1: how far the clearing has grown (0 no card has left, 1 every card has). */
export function clearAt(s: number): number {
  const [a, b] = ROWS_BEATS.clear;
  return ramp(s, a, b);
}

/** 0 to 1: the film turns upright. */
export function morphAt(s: number): number {
  const [a, b] = ROWS_BEATS.morph;
  return ramp(s, a, b);
}

/** The clearing's reach in the plane's pixels, from its progress, for a clearing that must cover `max` and soften over `feather`. */
export function clearRadius(progress: number, max: number, feather: number): number {
  return smootherstep(clamp(progress)) * (max + feather);
}

/**
 * How far a card at distance `rho` from the film has gone: 0 untouched, 1 gone. The card nearest the
 * film leaves first. `feather` is the distance over which a card goes.
 */
export function leaveOf(radius: number, rho: number, feather: number): number {
  return clamp((radius - rho) / feather);
}
