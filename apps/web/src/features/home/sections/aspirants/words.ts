/**
 * The owner's words on the right of the wall, as a TRIGGER (round three, 20 Nov 2026): when the wall
 * has landed they play in on a short clock (about 0.9 s, a staggered rise), and when the visitor leaves
 * they play out. Scrolling inside the rest changes nothing about them, so they never go while the page
 * moves (the round two bug: they were tied to the scroll's own position and to a play's clock, and
 * went with the section's slot).
 *
 * Pure: no DOM, no three.js. The runtime keeps one number, the clock `t`, and asks for each line's
 * progress. The two thresholds have a hysteresis, so a page that rests exactly on one never flickers.
 */
import { SLIDE_ORIGIN } from "../../fx/image-field/scroll-slide";

/** The absolute scroll (screens) from which the wall has landed and the words may come in. */
export const WORDS_SHOW_AT = SLIDE_ORIGIN;
/** Going back, the words leave this many screens below `WORDS_SHOW_AT` (so the threshold has two sides). */
export const WORDS_BACK_MARGIN = 0.1;
/**
 * Going on, the words leave when the close has begun (`v` of the section above `WORDS_LEAVE_V`) and return
 * below `WORDS_RETURN_V`. Both stand clear of the snap's own edge (`ZONE_EDGE`, 0.02 of the zone, `kernel/scrub.ts`):
 * a page the snap has put back on the rest is still a hair inside the zone (the smoothed scroll arrives last),
 * and the words must come back for it.
 */
export const WORDS_LEAVE_V = 1.08;
export const WORDS_RETURN_V = 1.04;

/** The clock's length (seconds): the last line has arrived when it has run this long. */
export const WORDS_SECONDS = 0.9;
/** The words go out this many times faster than they come in. */
const WORDS_OUT_SPEED = 2.6;
/** Each line starts this much later than the one before (seconds), and takes `LINE_SECONDS`. */
export const LINE_STAGGER = 0.14;
export const LINE_SECONDS = 0.62;
/** A frame longer than this (a stalled tab, a first draw) does not jump the clock. */
const MAX_DT = 0.1;

/**
 * Whether the words should be shown, for the page's absolute scroll `S` and the section's own `v` (1 at
 * rest, 1 to 2 across the close). `shown` is what it was: it decides which side of a threshold counts.
 */
export function wordsShown(shown: boolean, S: number, v: number): boolean {
  const landed = S >= (shown ? WORDS_SHOW_AT - WORDS_BACK_MARGIN : WORDS_SHOW_AT);
  const resting = v <= (shown ? WORDS_LEAVE_V : WORDS_RETURN_V);
  return landed && resting;
}

/** The clock after `dt` seconds: it runs forward while the words are shown and back, faster, while they are not. */
export function stepWordsClock(t: number, shown: boolean, dt: number): number {
  const step = Math.min(Math.max(dt, 0), MAX_DT);
  const next = t + (shown ? step : -step * WORDS_OUT_SPEED);
  return Math.min(WORDS_SECONDS, Math.max(0, next));
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Line `k` (0 the title) at clock `t`: 0 not there, 1 there. A cubic ease out, so a line settles into its place. */
export function lineAt(t: number, k: number): number {
  const u = clamp01((t - k * LINE_STAGGER) / LINE_SECONDS);
  return 1 - (1 - u) * (1 - u) * (1 - u);
}
