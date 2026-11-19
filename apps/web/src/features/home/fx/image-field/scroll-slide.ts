/**
 * How far the plane of cards has slid at a scroll position (round three, 20 Nov 2026; eased in round five).
 * The wall and the rows are one plane, so the one function serves both: a section that shows the plane
 * asks for `scrollSlide(geom, S)` and hands it to `field.holdSlideAt`. Pure.
 *
 * It is the scroll's, in both directions, never a clock: a stop makes the pictures stand. Round five (the
 * owner, 20 Nov 2026): the speed is not constant. The pictures move slowly at the first scroll and gain
 * speed over time (an ease in: the offset grows with a power of the scroll, so the speed grows with the
 * scroll), up to where the rows' transition begins (`SLIDE_EASE_END`). There `sections/rows/slide.ts` takes
 * over with a cubic that starts at exactly this speed and comes to rest as the film's space arrives (the
 * ease out). One profile for the wall and the rows: no change of speed at the joint between them.
 */
import { ramp } from "./math";
import type { WallGeom } from "./wall";

/** Pitches (a card and its gap) the plane slides between the origin and the end of the ease in. */
export const SLIDE_PITCHES = 4;

/** The exponent of the ease in: 2 is a speed that grows in a straight line from nothing. */
export const SLIDE_EASE_POWER = 2;

/**
 * The scroll (screens) where the hero's zone ends and the wall has landed: the plane stands still until
 * then (the cards fly to their places on a wall that does not move) and slides from there.
 * It is `HERO_REST + HERO_ZONE` of `sections/hero/index.ts` (`sections/aspirants/words.test.ts` keeps them equal).
 */
export const SLIDE_ORIGIN = 2.9;

/**
 * The scroll (screens) where the ease in ends and the rows' transition begins: the start of the rows'
 * zone, `sectionStart("rows") + ROWS_DWELL` (`sections/rows/slide.test.ts` keeps them equal).
 */
export const SLIDE_EASE_END = 5.5;

/** How far along the ease in the scroll `S` is, 0 to 1 (0 before the origin, 1 from the end on). */
export function slideProgress(S: number, end: number = SLIDE_EASE_END): number {
  return end > SLIDE_ORIGIN ? ramp(S, SLIDE_ORIGIN, end) : 0;
}

/**
 * The plane's slide (px of the plane) at the absolute scroll `S`: screens from the top of the page, as
 * `frame.S` is, never the story axis (`sections/story.ts`), which is a different number. It rises from 0
 * at the origin to `SLIDE_PITCHES` pitches at `end`, with no speed at the origin and a growing one after.
 */
export function scrollSlide(g: WallGeom, S: number, end: number = SLIDE_EASE_END): number {
  return SLIDE_PITCHES * g.pitch * slideProgress(S, end) ** SLIDE_EASE_POWER;
}

/**
 * The slide's speed at `S`, in px of the plane for each screen of scroll (the derivative of `scrollSlide`).
 * At `end` it is the speed the ease in arrives with, which the rows' cubic starts from; past `end` the
 * ease in is over and this reads 0.
 */
export function scrollSlideSpeed(g: WallGeom, S: number, end: number = SLIDE_EASE_END): number {
  if (!(end > SLIDE_ORIGIN) || S < SLIDE_ORIGIN || S > end) return 0;
  const x = ramp(S, SLIDE_ORIGIN, end);
  return (
    (SLIDE_PITCHES * g.pitch * SLIDE_EASE_POWER * x ** (SLIDE_EASE_POWER - 1)) /
    (end - SLIDE_ORIGIN)
  );
}
