/**
 * How far the plane of cards has slid at a scroll position (round three, 20 Nov 2026): with the scroll,
 * never by itself. The wall and the rows are one plane, so the one function serves both: a section
 * that shows the plane asks for `scrollSlide(geom, S)` and hands it to `field.holdSlideAt`, and the
 * pictures slide a fixed share of a card for every screen the visitor scrolls, in both directions. A
 * flick makes them go fast, a stop makes them stand. Pure.
 */
import type { WallGeom } from "./wall";

/** Pitches (a card and its gap) the plane slides for each screen of scroll. */
export const SLIDE_PITCHES_PER_SCREEN = 2;

/**
 * The scroll (screens) where the hero's zone ends and the wall has landed: the plane stands still until
 * then (the cards fly to their places on a wall that does not move) and slides with the scroll from there.
 * It is `HERO_REST + HERO_ZONE` of `sections/hero/index.ts` (`sections/aspirants/words.test.ts` keeps them equal).
 */
export const SLIDE_ORIGIN = 2.9;

/**
 * The plane's slide (px of the plane) at the absolute scroll `S`: screens from the top of the page, as
 * `frame.S` is, never the story axis (`sections/story.ts`), which is a different number.
 */
export function scrollSlide(g: WallGeom, S: number): number {
  return Math.max(0, S - SLIDE_ORIGIN) * SLIDE_PITCHES_PER_SCREEN * g.pitch;
}
