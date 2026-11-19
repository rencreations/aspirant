/**
 * The rows' transition, as pure functions of `s`, the story position in screens from the start of the
 * rows' transition (0 the rows at rest, `STORY.rows.length` the strip's small state: joint J3). A jump
 * lands exactly and the strip, which runs in the tail of the rows, agrees at the joint.
 *
 * Round three (20 Nov 2026): the transition is scroll based. `s` is the visitor's scroll through a
 * zone (the kernel's, `index.ts`), so every function here is also its own reverse: scroll up and the
 * film leaves, the pictures come back, the rows slide the other way. Nothing here has a clock.
 *
 * What happens. The pictures slide along their rows with the scroll (`slide.ts`). Then a space opens
 * in the middle row (the neighbours slide apart by the row's own gap, so the space is one more place of
 * the row), the film shows in it at the size of a picture (16 to 9, on the rows' plane, tilted as they
 * are), rides on with its row to the middle of the screen where the rows come to rest, the other
 * pictures slide off along their rows, and the film grows and turns upright into the strip.
 *
 *   slide   the rows come to rest (a cubic that starts at the speed the scroll gave them)
 *   gap     the space opens in the middle row, before the film shows in it
 *   appear  the film fades in, in the space, at full size: it never overlaps a picture
 *   clear   every other picture slides off along its row, the nearest to the film first
 *   morph   the film grows and turns upright into the strip (done at the end: J3)
 *
 * Distances are in the plane's pixels, `pitch` is a card and its gap along a row.
 */
import { clamp, ramp, smootherstep } from "../../fx/image-field/math";
import { WALL_DISTANCE, rowWay, type WallGeom } from "../../fx/image-field/wall";

/** The beats, in screens from the start of the transition. */
export const ROWS_BEATS = {
  /** The rows slide until here and come to rest. */
  slide: [0, 1.1],
  /** The space opens in the middle row. */
  gap: [0, 0.45],
  /** The film shows in the space (only once the space is open: it never overlaps a picture). */
  appear: [0.45, 0.8],
  /** The clearing grows from the film outward: every other picture slides off. */
  clear: [1.1, 1.8],
  /** The film grows and turns from angled to upright (done at the end of the section: J3). */
  morph: [1.8, 2.4],
} as const;

/** The film on the rows plane, as a share of a card's width: the same size as a picture (both are 16 to 9). */
export const ANGLE_SIZE = 1;
/** The least the rows slide in all, in pitches (and the floor of the film's ride). */
export const MIN_RIDE_PITCHES = 1.5;

/**
 * How far the rows have slid, 0 to 1, as the cubic that starts with slope `a` and comes to rest:
 * `h(x) = a x + (3 - 2a) x^2 + (a - 2) x^3`. `a` is the speed the scroll gave them, so nothing jumps
 * where the transition takes over (0 is a plain smoothstep, 3 is the steepest that stays monotone).
 */
export function slideShape(s: number, a = 0): number {
  const [from, to] = ROWS_BEATS.slide;
  const x = ramp(s, from, to);
  const k = clamp(a, 0, 3);
  return k * x + (3 - 2 * k) * x * x + (k - 2) * x * x * x;
}

/** 1 at the start of the ride (the film is as far out as the rows slide), 0 once the rows rest (the film is at the middle). */
export function filmAlong(s: number, a = 0): number {
  return 1 - slideShape(s, a);
}

/** 0 to 1: the space in the middle row is open. */
export function gapAt(s: number): number {
  const [from, to] = ROWS_BEATS.gap;
  return smootherstep(ramp(s, from, to));
}

/** 0 to 1: the film shows in the space. */
export function appearAt(s: number): number {
  const [from, to] = ROWS_BEATS.appear;
  return ramp(s, from, to);
}

/** 0 to 1: how far the clearing has grown (0 no card has left, 1 every card has). */
export function clearAt(s: number): number {
  const [from, to] = ROWS_BEATS.clear;
  return ramp(s, from, to);
}

/** 0 to 1: the film turns upright. */
export function morphAt(s: number): number {
  const [from, to] = ROWS_BEATS.morph;
  return ramp(s, from, to);
}

/**
 * The clearing's reach, from its progress, for a clearing that must cover `max` and soften over
 * `feather`. Linear: the scroll is the visitor's own easing, and every card leaves with its own ease.
 */
export function clearRadius(progress: number, max: number, feather: number): number {
  return clamp(progress) * (max + feather);
}

/**
 * How far a card at distance `rho` from the film has gone: 0 untouched, 1 gone. The card nearest the
 * film leaves first. `feather` is the distance over which a card goes.
 */
export function leaveOf(radius: number, rho: number, feather: number): number {
  return clamp((radius - rho) / feather);
}

/**
 * How far the film rides in all, in the plane's pixels, when the transition begins with the rows at
 * `slide`. It is at least `reach` (the film must start outside the screen), at least `MIN_RIDE_PITCHES`
 * and at least `floor` (what the slide's cubic needs to start at the speed the scroll gave the rows:
 * `slope <= 2.5`), and the least that puts the space between two cards of the middle row, so no card is
 * under the film. `gridAt` is where a card of that row stands in the row's own frame (its first
 * card's place, modulo a pitch).
 */
export function rideDistance(g: WallGeom, slide: number, reach: number, floor = 0): number {
  const r = g.midRow;
  const way = rowWay(r);
  const count = g.rowCount[r]!;
  const grid0 = g.rowCenter[r]! - ((count - 1) / 2) * g.pitch;
  const least = Math.max(reach, MIN_RIDE_PITCHES * g.pitch, floor);
  // The film is `way * (ride + slide)` back along the row from the middle, in the row's frame. The
  // space is between two cards when that sits half a pitch from the card grid.
  const phase = (((-way * (grid0 + g.pitch / 2) - slide) % g.pitch) + g.pitch) % g.pitch;
  return phase + Math.ceil((least - phase) / g.pitch) * g.pitch;
}

/** The film's place along the middle row (plane u) when the rows have come to rest: the middle of the screen. */
const FILM_END_U = 0;

/** Where the film starts along the middle row, in plane u (signed): `ride` back from the middle, against the way the row goes. */
export function filmStartU(g: WallGeom, ride: number): number {
  return -rowWay(g.midRow) * ride + FILM_END_U;
}

/**
 * How far the film must start along the middle row (plane u): half way from the middle to the screen's
 * edge on the farther side, so it shows in the space at a place the visitor can see, and rides in from there.
 */
export function rideReach(g: WallGeom, screenWidth: number): number {
  const d = WALL_DISTANCE;
  const half = screenWidth / 2;
  let edge = 0;
  for (const x of [-half, half]) {
    edge = Math.max(edge, Math.abs((x * d) / (d * g.right[0] + x * g.right[2])));
  }
  // Half way to the edge: the film shows in the space where the visitor can already see it open.
  return 0.5 * edge;
}
