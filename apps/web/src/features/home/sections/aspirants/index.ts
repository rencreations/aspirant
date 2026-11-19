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
 * 2. The close. The wall is a plane of small cards over the whole screen, seen through a clip; after a
 *    dwell of about a screen (this section has words and information: the owner asked for a longer
 *    threshold, "scroll more to trigger") the next scroll slides the words out to the right and opens
 *    the clip, a hard edge that sweeps out and shows the rest of the plane. The cards never stop: the
 *    glide goes on as the rows. 1.2 s, scroll held. Back plays it in reverse.
 *
 * `update` gets 0 to 1 for the first play and 1 to 2 for the second (`aspirantsS` in `hero/timeline.ts`).
 * The ground stays light: it goes dark with the rows' transition, not with the close.
 */
const ASPIRANTS_SCREENS = 1.3;
/** Screens of scroll between the hero's play and the close: the dwell on the words. */
const ASPIRANTS_DWELL = 1;
/** The close fires at this share of the section. */
const ASPIRANTS_CLOSE_AT = ASPIRANTS_DWELL / ASPIRANTS_SCREENS;
/** The close, in seconds going forward. */
const ASPIRANTS_CLOSE_SECONDS = 1.2;

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
