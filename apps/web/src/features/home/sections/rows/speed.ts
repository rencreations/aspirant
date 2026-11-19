/**
 * How fast the rows glide, and how dark the ground is while they do. Pure.
 *
 * The rows never stop. Their speed is the idle glide of the wall plus what the visitor's scroll adds:
 * the size of `frame.input.wheel` (px/s of the scroll, the direction does not matter: a scroll up
 * makes the rows faster too), scaled and capped. The field's carousel eases toward the speed asked
 * (0.3 s), so a flick builds up and dies away smoothly.
 */
import { clamp, ramp, smootherstep } from "../../fx/image-field/math";

/** The idle glide, px/s of the plane (the wall's own rate, so the wall's glide goes on unchanged). */
export const IDLE_RATE = 80;
/** Plane pixels per second added for each pixel per second of scroll. */
const BOOST_GAIN = 0.4;
/** The most the scroll can add (about five card widths a second). */
export const BOOST_MAX = 1300;

/** The glide asked of the field, px/s. `wheel` is the signed input energy. */
export function rowsRate(wheel: number): number {
  return IDLE_RATE + Math.min(BOOST_MAX, BOOST_GAIN * Math.abs(wheel));
}

/** How far the ground has gone toward dark by the end of the dwell (the rest follows the play). */
export const DWELL_DARK = 0.2;

/**
 * The ground's progress toward the storm, 0 (daybreak) to 1. `dwell` is how far the visitor has
 * scrolled through the rows' section (0 to 1, scroll linked), `s` the story position of the play in
 * screens. The play finishes what the dwell began, from `DWELL_DARK` at its start to 1, so nothing
 * steps where the play takes over.
 */
export function groundDark(dwell: number, s: number, from: number, to: number): number {
  const before = DWELL_DARK * smootherstep(clamp(dwell));
  const during = ramp(s, from, to);
  return before + (1 - before) * smootherstep(during);
}
