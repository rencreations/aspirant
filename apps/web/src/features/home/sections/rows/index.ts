import type { HomeSection } from "../../kernel/types";
import { ASPIRANTS_CLOSE_AT, ASPIRANTS_SCREENS } from "../aspirants";

import { preload } from "./preload";

/**
 * The angled rows, the small film and its turn into the strip, as one play (round two, 19 Nov 2026).
 * The ground is dark from the aspirants' close (their play sets it), so the rows stand on it at rest:
 * the full screen rows at the same angle, quiet, under a live backdrop. After a short dwell the next
 * scroll fires the play: the rows slide, an angled film appears in a gap of the middle row and rides it
 * to the middle, the other cards leave from the film outward, and the film turns upright into the strip.
 * It runs 3 s on a clock with the scroll held, and scrolling back plays it in reverse.
 *
 * The strip fires its first play at the same scroll (`at: 0` there, `at: 1` here) and runs it in step:
 * that is where the strip's small words come in. `update` gets 0 (the rows) to 1 (the strip's small
 * state); `s = v * STORY.rows.length` in `runtime.ts`. `lead` lets this section run while the wall is
 * still closing; it does nothing there (the lead rests).
 */
const ROWS_SCREENS = 0.3;
/** The play of the rows, in seconds going forward. */
export const ROWS_PLAY_SECONDS = 3;

export const section: HomeSection = {
  id: "rows",
  screens: ROWS_SCREENS,
  lead: 0.3,
  tail: 0.4,
  bg: "storm",
  // The top bar turns dark when the aspirants' close fires, 0.63 screens of dwell after the hero's play.
  nav: { theme: "storm", early: ASPIRANTS_SCREENS * (1 - ASPIRANTS_CLOSE_AT) },
  dom: "fixed",
  restOutside: true,
  plays: [{ at: 1, from: 0, to: 1, seconds: ROWS_PLAY_SECONDS, ease: "linear" }],
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
