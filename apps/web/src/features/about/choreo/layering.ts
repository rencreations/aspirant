import { uncovered, type Box } from "../film-geometry";

import { CLEAR_REACH, EDGE, type Side } from "./path";

/**
 * Which side of the film the drone is drawn on. The owner asked for both: the drone is behind the
 * growing film on its way to the perch, and it comes toward the visitor for the statement while
 * "the video stays behind". One layer cannot be both, so the drone's layer changes its place in
 * the stack. A change while any of the drone is over the film would show as a jump, so:
 *
 * - the path says which side the drone belongs on for a scroll (`wanted`);
 * - the layer changes only when the drone AS DRAWN is clear of the film as it is now;
 * - while the two differ and the drone is headed for a place that is not clear either, it goes
 *   to the nearest clear place first (above the window's edge when it sits on the perch), and
 *   carries on once the layer has changed;
 * - in a fast scroll there is no time for that way round and the film itself is moving fast: then
 *   the layer changes at once if at least half of the drone is clear of the film (it sits on the
 *   perch with a third of it behind the window), which the eye does not catch at that speed. A
 *   drone that is mostly over the film still goes round, so it is never made to vanish.
 *
 * So a flick or a jump of the scroll can never leave it on the wrong side, or out of sight.
 */

interface Place {
  x: number;
  y: number;
  size: number;
}

interface LayerInput {
  wanted: Side;
  actual: Side;
  /** The drone as it is drawn now, and where it is headed. */
  pose: Place;
  target: Place;
  /** The film's picture on the screen now, or null when there is none. */
  film: Box | null;
  vw: number;
  vh: number;
  navH: number;
  /** The scroll is fast: there is no time to go round. */
  hurry?: boolean;
}

interface LayerOutput {
  side: Side;
  /** Where to go first, when the drone cannot change sides where it is headed. */
  detour: Place | null;
}

/** The air kept between the drone and the film's edge at a clear place. */
const AIR = 10;
/** The smallest the drone is drawn in to fit a clear place. */
const SMALLEST = 44;
/** In a hurry the layer may change while this much of the drone, at least, is clear of the film. */
const HURRY_SEEN = 0.5;

/** True when nothing of a drone at this place is over the film. */
export function isClear(p: Place, film: Box): boolean {
  const r = p.size * CLEAR_REACH;
  return uncovered(p.x, p.y, r, film) === 1;
}

/** The nearest place to `from` where a drone of about its size is clear of the film. */
export function nearestClear(
  from: Place,
  film: Box,
  vw: number,
  vh: number,
  navH: number,
): Place | null {
  const reach = CLEAR_REACH;
  const top = navH + EDGE;
  const options: Place[] = [];
  /** A drone of the size that fits `room`, or nothing when the room is too small. */
  const sized = (room: number): number | null => {
    const size = Math.min(from.size, (room - AIR) / (0.5 + reach));
    return size >= Math.min(SMALLEST, from.size) ? size : null;
  };
  const x = Math.min(Math.max(from.x, EDGE + from.size / 2), vw - EDGE - from.size / 2);
  const y = Math.min(Math.max(from.y, top + from.size / 2), vh - EDGE - from.size / 2);
  const above = sized(film.y - top);
  if (above !== null) options.push({ x, y: film.y - reach * above - AIR, size: above });
  const below = sized(vh - EDGE - (film.y + film.h));
  if (below !== null) options.push({ x, y: film.y + film.h + reach * below + AIR, size: below });
  const left = sized(film.x - EDGE);
  if (left !== null) options.push({ x: film.x - reach * left - AIR, y, size: left });
  const right = sized(vw - EDGE - (film.x + film.w));
  if (right !== null) options.push({ x: film.x + film.w + reach * right + AIR, y, size: right });

  let best: Place | null = null;
  let least = Infinity;
  for (const o of options) {
    // A place that asks the drone to shrink is further away than it looks.
    const cost = Math.hypot(o.x - from.x, o.y - from.y) + 2.5 * (from.size - o.size);
    if (cost < least) {
      least = cost;
      best = o;
    }
  }
  return best;
}

/** One frame of the rule above. */
export function layerStep(input: LayerInput): LayerOutput {
  const { wanted, actual, pose, target, film, vw, vh, navH, hurry } = input;
  if (wanted === actual) return { side: actual, detour: null };
  // No film on the screen: nothing can show the change.
  if (!film || film.y + film.h <= 0 || film.y >= vh || film.w <= 0) {
    return { side: wanted, detour: null };
  }
  if (isClear(pose, film)) return { side: wanted, detour: null };
  if (hurry && uncovered(pose.x, pose.y, pose.size / 2, film) >= HURRY_SEEN) {
    return { side: wanted, detour: null };
  }
  if (isClear(target, film)) return { side: actual, detour: null };
  return { side: actual, detour: nearestClear(pose, film, vw, vh, navH) };
}
