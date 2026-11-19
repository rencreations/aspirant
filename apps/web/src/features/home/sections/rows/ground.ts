/**
 * The backdrop of the rows' transition, as a pure function of `s` (the story position in screens from
 * the transition's start). Scroll based and reversible. The home page is light only (round five, the
 * owner, 20 Nov 2026): the ground stays the daybreak paper through the whole transition and the film
 * turns upright on it. Only the light silk of the rows goes out, ahead of the strip's own backdrop
 * (`backdrops.ts`), so nothing flashes where the two meet.
 */
import { ramp, smootherstep } from "../../fx/image-field/math";

import { ROWS_BEATS } from "./journey";

/** The share of the rows' silk that is still there, 1 to 0: it goes out while the pictures clear. */
export function silkShare(s: number): number {
  return 1 - smootherstep(ramp(s, ROWS_BEATS.gap[0], ROWS_BEATS.clear[1] - 0.2));
}
