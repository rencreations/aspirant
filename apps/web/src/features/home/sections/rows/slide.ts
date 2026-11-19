/**
 * How the rows slide (round three, 20 Nov 2026): with the scroll, never by themselves. Before the
 * transition the plane slides a fixed share of a picture for every screen the visitor scrolls, in both
 * directions (`fx/image-field/scroll-slide.ts`, shared with the wall). The transition
 * (`journey.ts`) then takes the slide over: it comes to rest with the film at the middle of the screen.
 *
 * Pure: no three.js, no DOM. Every number is a function of the scroll position, so a seek, a jump and a
 * scroll back land exactly.
 */
import { SLIDE_PITCHES_PER_SCREEN, scrollSlide } from "../../fx/image-field/scroll-slide";
import type { Vp } from "../../fx/image-field/types";
import type { WallGeom } from "../../fx/image-field/wall";

import { filmStartU, rideDistance, rideReach, ROWS_BEATS } from "./journey";

export { SLIDE_PITCHES_PER_SCREEN, scrollSlide };

/** The steepest start the slide's cubic is allowed (3 is the limit that stays monotone). */
const MAX_SLOPE = 2.5;

/** What the transition needs to know about where it starts: fixed by the scroll, so it never depends on history. */
export interface Ride {
  /** The slide at the start of the transition (the scroll's own, `scrollSlide` at the zone's start). */
  phase0: number;
  /** How far the rows slide in all, px of the plane. */
  ride: number;
  /** Where the film starts along the middle row (plane u, signed). */
  startU: number;
  /** The slope the slide's cubic starts with: the scroll's own speed, so nothing jumps where it takes over. */
  slope: number;
}

/**
 * The ride of a transition that starts at the absolute scroll `zoneStart` and takes `zoneScreens` of
 * scroll (the whole story, `storyLength` screens of it). The slide beat is `ROWS_BEATS.slide[1]` of the
 * `storyLength`, so it takes that share of the zone's scroll. `anchor` is what the plane's slide carried
 * over the scroll's own when the rows took it over (`runtime.ts`: 0 when the wall follows `scrollSlide`).
 */
export function planRide(
  g: WallGeom,
  vp: Vp,
  zoneStart: number,
  zoneScreens: number,
  storyLength: number,
  out: Ride,
  anchor = 0,
): Ride {
  const phase0 = scrollSlide(g, zoneStart) + anchor;
  // Scroll screens the slide beat spans, and the plane px the scroll alone would slide in them.
  const slideScroll = (ROWS_BEATS.slide[1] / storyLength) * zoneScreens;
  const scrollPx = SLIDE_PITCHES_PER_SCREEN * g.pitch * slideScroll;
  const ride = rideDistance(g, phase0, rideReach(g, vp.w), scrollPx / MAX_SLOPE);
  out.phase0 = phase0;
  out.ride = ride;
  out.startU = filmStartU(g, ride);
  out.slope = scrollPx / ride;
  return out;
}

export function makeRide(): Ride {
  return { phase0: 0, ride: 0, startU: 0, slope: 0 };
}
