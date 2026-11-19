/**
 * The ground and the backdrop of the rows' transition, as pure functions of `s` (the story position
 * in screens from the transition's start). Scroll based and reversible: the ground goes from the
 * daybreak paper to the storm night while the pictures clear, the light silk of the wall fades out
 * with it, and the strip's own dark backdrop comes in only where the transition ends (`backdrops.ts`),
 * so nothing flashes.
 */
import { ramp, smootherstep } from "../../fx/image-field/math";

import { ROWS_BEATS } from "./journey";

/** Where the ground crosses from daybreak to storm, in screens of the transition. */
const GROUND: readonly [number, number] = [ROWS_BEATS.gap[1], ROWS_BEATS.clear[1]];

/** 0 the daybreak paper, 1 the storm night. */
export function groundDark(s: number): number {
  return smootherstep(ramp(s, GROUND[0], GROUND[1]));
}

/** The share of the wall's silk that is still there, 1 to 0: it goes out a little ahead of the paper. */
export function silkShare(s: number): number {
  return 1 - smootherstep(ramp(s, ROWS_BEATS.gap[0], ROWS_BEATS.clear[1] - 0.2));
}
