import { playsOf, type BeatStep } from "../../kernel/beat";
import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { ROWS_DWELL, ROWS_SCREENS, ROWS_ZONE, ROWS_ZONE_SECONDS } from "./zone";

/**
 * The rows and their transition into the strip (round three, 20 Nov 2026: scroll based).
 *
 * The rows are the aspirants' wall with the clip open: one plane of cards over the whole screen. The
 * pictures slide along their rows with the visitor's scroll (no glide of their own, both directions:
 * `slide.ts`) for a short dwell, then the transition is a scroll ZONE (`kernel/scrub.ts`) of about a
 * screen and a bit: a space opens in the middle row, the film shows in it at the size of a picture and
 * rides with the row to the middle, the other pictures slide off along their rows, and the film grows
 * and turns upright into the strip. The ground goes dark through it (`ground.ts`). If the visitor stops
 * inside the zone the page finishes it by itself, forward or back. `update` gets 0 in the dwell, 0 to 1
 * across the zone and 1 after it; the lead is negative (the aspirants' close still owns the field there)
 * and the dwell's slide comes from the scroll itself (`frame.S`).
 *
 * The zone ends 0.3 screens before the section does (`ROWS_REST`, the strip's lead): the film stands upright as the
 * strip for those, and the strip, which starts where this section ends, draws the same state.
 */
const STEPS: readonly BeatStep[] = [
  { atScreens: ROWS_DWELL, spanScreens: ROWS_ZONE, to: 1, seconds: ROWS_ZONE_SECONDS },
];

export const section: HomeSection = {
  id: "rows",
  screens: ROWS_SCREENS,
  lead: 0.3,
  tail: 0.4,
  // The rows stand on the light ground of the wall: it goes dark inside the transition (the runtime's cue).
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  plays: playsOf(0, 1, ROWS_SCREENS, STEPS),
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
