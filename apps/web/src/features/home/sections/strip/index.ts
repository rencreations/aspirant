import type { HomeSection } from "../../kernel/types";
import { ROWS_PLAY_SECONDS } from "../rows";

import { preload } from "./preload";

/**
 * The psychoactive hero as four plays (round two, 19 Nov 2026). Rest states, each a composed frame
 * the visitor stands in:
 *
 * 1. the small ultra wide frame with its words (the first play brings the words in, in step with the
 *    rows' play: `at: 0` here, `at: 1` there; it draws nothing but the words);
 * 2. the window with the play button (the expand, 1.5 s);
 * 3. the orbit of the ten films under "Official animations for The Aspirants" (the pull, 1.8 s);
 * 4. the fly-off to the bottom right (1.4 s), which ends on a bare dark screen under the backdrop:
 *    the bolt follows.
 *
 * `update` gets 0 to 4 (`stripS` in `journey.ts` turns it into story screens). The fly-off fires at the
 * end of the section (`at: 1`), the same scroll at which the bolt's own first play can fire.
 */
const STRIP_SCREENS = 1.8;

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
    { at: 0, from: 0, to: 1, seconds: ROWS_PLAY_SECONDS, ease: "linear" },
    { at: 0.3, from: 1, to: 2, seconds: 1.5, ease: "inOutSoft" },
    { at: 0.65, from: 2, to: 3, seconds: 1.8, ease: "inOutSoft" },
    { at: 1, from: 3, to: 4, seconds: 1.4, ease: "inOutSoft" },
  ],
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
