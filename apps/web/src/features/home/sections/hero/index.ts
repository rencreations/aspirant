import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";

/**
 * The logo and the splash cards (premotio's hero), as one scroll ZONE (round three, 20 Nov 2026).
 * The page opens on the scatter, the rest state of the hero (the cards fly in on a clock, the paper
 * entrance, `fx/image-field/flight.ts`). Then the visitor scrolls and the scene plays by the scroll:
 * the logo morphs into the bar, the cards above gather, spiral into the ring and land as the wall.
 * Scrolling back plays it back. If the visitor stops in the middle the page stays exactly there: the
 * zone has no idle snap (`noSnap`, round eight), it is a plain scroll linked passage.
 *
 * The zone is `HERO_ZONE` screens long, after a short rest on the scatter (`HERO_REST`) and before a
 * short dwell on the wall (`HERO_DWELL`): the aspirants' words are a trigger that comes after the
 * dwell. `heroS` (`timeline.ts`) turns the zone's value (0 the scatter, 1 the wall) into the story
 * position, so every beat of the scene is unchanged. `carry`: a jump past the hero replays its end,
 * which gives the bar its own logo.
 */
/** Screens of rest on the scatter before the zone starts (the cue, the stiff logo). */
export const HERO_REST = 0.1;
/** The length of the zone, in screens: the whole of the scene (the morph, the gather, the ring, the land). */
export const HERO_ZONE = 2.8;
/** Screens of dwell on the wall after the zone, before the words' trigger of the aspirants. */
export const HERO_DWELL = 0.2;
/** The length of the section in screens. */
export const HERO_SCREENS = HERO_REST + HERO_ZONE + HERO_DWELL;
/** Kept for the table's validation only: the zone has `noSnap`, so the page never carries the scene by itself. */
export const HERO_SNAP_SECONDS = 2.4;
/**
 * The aspirants' first play (the words) still runs this long on a clock (round two). It is the
 * aspirants' to change: the hero no longer plays on a clock.
 */
export const HERO_PLAY_SECONDS = 2.8;

export const section: HomeSection = {
  id: "hero",
  screens: HERO_SCREENS,
  lead: 0,
  tail: 0.4,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  restOutside: true,
  carry: true,
  plays: [
    {
      at: HERO_REST / HERO_SCREENS,
      span: HERO_ZONE / HERO_SCREENS,
      from: 0,
      to: 1,
      seconds: HERO_SNAP_SECONDS,
      ease: "linear",
      // Round eight: a plain scroll linked passage. Nothing finishes it by itself when the visitor stops.
      noSnap: true,
    },
  ],
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
