/**
 * The rows' transition, as pure functions of `s`, the story position in screens from the start of the
 * rows' play (0 the rows at rest, `STORY.rows.length` the strip's small state: joint J3). A jump lands
 * exactly and the strip, which runs in the tail of the rows, agrees at the joint.
 *
 * What happens (round two, 19 Nov 2026). Until the play the rows glide by themselves for ever (the
 * visitor's scroll makes them faster). The play is the transition the owner described: the film is the
 * next thing that scrolls in on the middle row. A space opens in that row (the cards on either side
 * slide apart), the film rides in with the row into the space, the rows come to rest with the film at
 * the middle, every other card clears away from it, and the film turns upright into the strip.
 *
 *   slide   the rows decelerate from the speed they had to rest (a cubic that starts at that speed)
 *   gap     the space opens in the middle row, before the film shows in it
 *   appear  the film fades and grows into the space
 *   clear   every other card leaves from the film outward
 *   morph   the film turns upright into the strip (done at the end: J3)
 *
 * Distances are in the plane's pixels, `pitch` is a card and its gap along a row.
 */
import { clamp, ramp, smootherstep } from "../../fx/image-field/math";
import { WALL_DISTANCE, rowWay, type WallGeom } from "../../fx/image-field/wall";

/** The beats, in screens from the start of the play. */
export const ROWS_BEATS = {
  /** The rows slide until here and come to rest. */
  slide: [0, 1.5],
  /** The space opens in the middle row. */
  gap: [0, 0.55],
  /** The film shows in the space (after it has begun to open, never before). */
  appear: [0.25, 0.8],
  /** The clearing grows from the film outward: every other card leaves. */
  clear: [1.1, 1.8],
  /** The film turns from angled to upright (done at the end of the section: J3). */
  morph: [1.8, 2.4],
} as const;

/** The film on the rows plane, as a share of a card's width (it is 1920 by 810, so shorter than a card). */
export const ANGLE_SIZE = 1;
/** Clear room kept between the film and the cards beside it, as a share of a card's width. */
export const GAP_MARGIN = 0.2;
/** The least the rows slide in all, in pitches (and the floor of the film's ride). */
export const MIN_RIDE_PITCHES = 1.5;

/**
 * How far the rows have slid, 0 to 1, as the cubic that starts with slope `a` and comes to rest:
 * `h(x) = a x + (3 - 2a) x^2 + (a - 2) x^3`. `a` is the speed the rows had, so nothing jumps when the
 * play begins (0 is a plain smoothstep, 3 is the steepest that stays monotone).
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

/**
 * How far the film rides in all, in the plane's pixels, when the play begins with the rows at `slide`
 * and moving at `speed` (px/s of the plane), and its slot in the row must end at the middle. It is at
 * least `reach` (the film must start outside the screen) and the least that (a) is steep enough for
 * the slide's cubic to start at `speed` (`a <= 3`) and (b) puts the space between two cards of the
 * middle row, so no card is under the film. `gridAt` is where a card of that row stands in the row's
 * own frame (its first card's place, modulo a pitch).
 *
 * `secondsPerShape` is how long the slide's whole shape takes in real time.
 */
export function rideDistance(
  g: WallGeom,
  slide: number,
  speed: number,
  reach: number,
  secondsPerShape: number,
): number {
  const r = g.midRow;
  const way = rowWay(r);
  const count = g.rowCount[r]!;
  const grid0 = g.rowCenter[r]! - ((count - 1) / 2) * g.pitch;
  const floor = Math.max(
    reach,
    MIN_RIDE_PITCHES * g.pitch,
    // The cubic starts at slope `a = speed * T / ride`: keep a at 2.5 or less.
    (Math.abs(speed) * secondsPerShape) / 2.5,
  );
  // The film is `way * (ride + slide)` back along the row from the middle, in the row's frame. The
  // space is between two cards when that sits half a pitch from the card grid.
  const phase = (((-way * (grid0 + g.pitch / 2) - slide) % g.pitch) + g.pitch) % g.pitch;
  return phase + Math.ceil((floor - phase) / g.pitch) * g.pitch;
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
