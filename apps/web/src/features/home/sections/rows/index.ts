import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";

/**
 * The rows and their transition into the strip (round two, 19 Nov 2026).
 *
 * The rows are the aspirants' wall with the clip open: one plane of small cards over the whole screen.
 * They never stop. They glide by themselves, endlessly, and the visitor's scroll makes them faster
 * (`frame.input.wheel`, see `speed.ts`); the cards still lift under the pointer and the wake still
 * ripples. The ground darkens a little as the visitor scrolls on (scroll linked, reversible), then at
 * the threshold, the end of this section's range, the TRANSITION fires as one play of 3 s with the
 * scroll held: a space opens in the middle row, the film rides in with the row into the space (never
 * over a picture), the rows come to rest, the other cards clear away from the film, and the film turns
 * upright into the strip. Scrolling back plays it in reverse.
 *
 * The strip fires its first play at the same scroll (`at: 0` there, `at: 1` here) and runs it in step:
 * that is where the strip's small words come in. `update` gets 0 (the rows at rest) to 1 (the strip's
 * small state); `s = v * STORY.rows.length` in `runtime.ts`. `lead` lets the section run while the wall
 * is still closing (it does nothing to the field there: the aspirants own it).
 *
 * The rows have no words, so the dwell is the short kind of a section made of motion: 0.7 screens, enough
 * to feel the speed answer the scroll.
 */
const ROWS_SCREENS = 0.7;
/** The play of the rows, in seconds going forward. */
export const ROWS_PLAY_SECONDS = 3;

export const section: HomeSection = {
  id: "rows",
  screens: ROWS_SCREENS,
  lead: 0.3,
  tail: 0.4,
  // The rows stand on the light ground of the wall: it goes dark inside the transition (the runtime's cue).
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  restOutside: true,
  plays: [{ at: 1, from: 0, to: 1, seconds: ROWS_PLAY_SECONDS, ease: "linear" }],
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
