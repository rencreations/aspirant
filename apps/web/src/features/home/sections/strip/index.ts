import type { HomeSection } from "../../kernel/types";

import { STRIP_AT, STRIP_SCREENS, STRIP_SPAN } from "./dwell";
import { preload } from "./preload";

/**
 * The psychoactive hero (round three, 20 Nov 2026: scroll based, but for the two triggers the owner
 * named). Rest states, each a composed frame the visitor stands in:
 *
 * 1. the small ultra wide frame with its words: they come in as a scroll ZONE (`kernel/scrub.ts`), up
 *    and down, and the film and the drone are already there (the rows' zone ended on it);
 * 2. the window with the play button, PLAY and FILMS: a TRIGGER on a clock (the expand, 1.5 s);
 * 3. the orbit of the ten films under "Official animations for The Aspirants": a TRIGGER on a clock
 *    (the pull, 1.8 s);
 * 4. the exit: a scroll ZONE, the set flies off to the bottom right as the visitor scrolls on to the
 *    next section, and the effects overlay of the film fades out with it. If the visitor stops inside
 *    a zone the page finishes it by itself.
 *
 * `update` gets 0 to 4 (`stripS` in `journey.ts` turns it into story screens). The zone of the exit
 * ends at the section's end: the bolt's lead (0.5 screens) lies over its last part. `dwell.ts` holds
 * the lengths, and `at` and `span` follow.
 */

export const section: HomeSection = {
  id: "strip",
  screens: STRIP_SCREENS,
  lead: 0.3,
  tail: 0.6,
  bg: "storm",
  nav: { theme: "storm" },
  dom: "fixed",
  restOutside: true,
  plays: [
    { at: 0, span: STRIP_SPAN.words, from: 0, to: 1, seconds: 0.9, ease: "linear" },
    { at: STRIP_AT.window, from: 1, to: 2, seconds: 1.5, ease: "inOutSoft" },
    { at: STRIP_AT.orbit, from: 2, to: 3, seconds: 1.8, ease: "inOutSoft" },
    { at: STRIP_AT.exit, span: STRIP_SPAN.exit, from: 3, to: 4, seconds: 1.4, ease: "linear" },
  ],
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
