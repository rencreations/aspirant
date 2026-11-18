import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";

/**
 * The logo and the splash cards (premotio's hero), as one triggered scene (round two, 19 Nov 2026).
 * The page opens on the scatter, the rest state of the hero. The first scroll of `screens` (0.3, the
 * small threshold) fires the play: the logo morphs into the bar, the cards above gather, spiral into
 * the ring and land as the wall, and the owner's words come in. It runs on a clock for 2.8 s with the
 * scroll held, and scrolling back up across the threshold plays it back.
 *
 * The aspirants fire their own play (the words) at the same scroll, with the same length and curve, so
 * the two machines run in step (`sections/pair.test.ts` holds the arithmetic): the thresholds are at
 * the joint (`at: 1`), and the hero keeps a tail so it is still running while the play holds. `carry`:
 * a jump past the hero replays its end, which gives the bar its own logo. Its `update` gets 0 for
 * the scatter and 1 for the wall (`heroS` in `timeline.ts`), and rests there in the tail.
 */
export const HERO_SCREENS = 0.3;
/** The play of the hero, in seconds going forward. */
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
  plays: [{ at: 1, from: 0, to: 1, seconds: HERO_PLAY_SECONDS, ease: "linear" }],
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
