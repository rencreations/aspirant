import type { HomeSection } from "../../kernel/types";
import { HERO_PLAY_SECONDS, HERO_SCREENS } from "../hero";

import { preload } from "./preload";

/**
 * The sliding wall of wide cards, as two plays (round two, 19 Nov 2026).
 *
 * 1. The words come in. It is the hero's play seen from this side: it fires at the same scroll
 *    (`at: 0` here, `at: 1` in the hero), runs the same 2.8 s on the same curve, and drives only the
 *    owner's words (they are this section's DOM). `lead` is the hero's length so this section runs
 *    from the top of the page and its back threshold equals the hero's.
 * 2. The close. After a dwell on the wall (the carousel slides by itself, a card lifts, VIEW opens the
 *    preview) the next scroll folds the words and opens the wall into the full screen rows on the dark
 *    ground, 1.5 s, scroll held. Back plays it in reverse.
 *
 * `update` gets 0 to 1 for the first play and 1 to 2 for the second (`aspirantsS` in `hero/timeline.ts`).
 * The dark ground comes with the close (`setGroundCue`), and the top bar turns with it through the
 * rows' `nav.early` (`ASPIRANTS_CLOSE_AT` below says where it fires).
 */
export const ASPIRANTS_SCREENS = 0.9;
/** The close fires at this share of the section: 0.63 screens of dwell after the hero's play. */
export const ASPIRANTS_CLOSE_AT = 0.7;
/** The close, in seconds going forward. */
const ASPIRANTS_CLOSE_SECONDS = 1.5;

export const section: HomeSection = {
  id: "aspirants",
  screens: ASPIRANTS_SCREENS,
  lead: HERO_SCREENS,
  tail: 0.3,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  restOutside: true,
  plays: [
    { at: 0, from: 0, to: 1, seconds: HERO_PLAY_SECONDS, ease: "linear" },
    {
      at: ASPIRANTS_CLOSE_AT,
      from: 1,
      to: 2,
      seconds: ASPIRANTS_CLOSE_SECONDS,
      ease: "inOut",
    },
  ],
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
