import type { HomeSection } from "../../kernel/types";

import { STRIP_AT, STRIP_SCREENS, STRIP_SPAN } from "./dwell";
import { preload } from "./preload";

/**
 * The psychoactive hero (round five, 20 Nov 2026: scroll based, but for the one trigger the owner
 * kept). It stands on the light daybreak ground like the rest of the home page. Rest states, each a
 * composed frame the visitor stands in:
 *
 * 1. the small ultra wide frame with its words: they come in as a scroll ZONE (`kernel/scrub.ts`), up
 *    and down, and the film and the drone are already there (the rows' zone ended on it);
 * 2. the window with the play button, PLAY and FILMS: a TRIGGER on a clock (the expand, 1.5 s);
 * 3. the pull: a scroll ZONE of about a screen. The window becomes the leader of the orbit of the ten
 *    films and the words of "Official animations for The Aspirants" come in, as the visitor scrolls. If
 *    the visitor stops inside it the page finishes it by itself, as every zone does;
 * 4. the orbit at rest (the heading, the line and the button);
 * 5. the exit: a scroll ZONE with NO SNAP (`noSnap`), the set flies off to the bottom right as the
 *    visitor scrolls on to the next section. The page is never finished by itself here: it stays
 *    where the visitor leaves it (the joint snap keeps out of a zone too).
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
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  restOutside: true,
  plays: [
    { at: 0, span: STRIP_SPAN.words, from: 0, to: 1, seconds: 0.9, ease: "linear" },
    { at: STRIP_AT.window, from: 1, to: 2, seconds: 1.5, ease: "inOutSoft" },
    { at: STRIP_AT.pull, span: STRIP_SPAN.pull, from: 2, to: 3, seconds: 1.4, ease: "linear" },
    {
      at: STRIP_AT.exit,
      span: STRIP_SPAN.exit,
      from: 3,
      to: 4,
      seconds: 1.4,
      ease: "linear",
      noSnap: true,
    },
  ],
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
