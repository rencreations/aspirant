import type { HomeSection } from "../../kernel/types";
import { HERO_SCREENS } from "../hero";

import { preload } from "./preload";

/**
 * The wall of big tilted pictures on the left 65 percent, the owner's words on the right 35 (round three,
 * 20 Nov 2026: scroll based, like premotio).
 *
 * The section has a rest and one scroll zone, and the scene it shows is the hero's landing (the hero's
 * own zone ends on the wall, `HERO_SCREENS` before this section starts, and this section's lead covers
 * it).
 *
 * 1. THE REST (`ASPIRANTS_REST`, about a screen: the section has words, so the visitor must scroll a
 *    little more before the page moves on). The words come in by a TRIGGER on a short clock when the wall
 *    has landed (`words.ts`), and the pictures slide along their rows with the scroll, up and down, and
 *    stand when the scroll stands (`fx/image-field/scroll-slide.ts`). A card lifts when hovered, the
 *    cursor says VIEW, a press opens the preview.
 * 2. THE CLOSE (`ASPIRANTS_CLOSE`, a scroll ZONE, `kernel/scrub.ts`): the words leave (a trigger), and
 *    the hard edge of the wall sweeps out and the plane opens into the full screen rows (the clip
 *    opens). The visitor drives it, up and down, and if they stop inside it the page finishes it by
 *    itself, forward or back. Its end is the rows' first frame (`rows/`).
 *
 * `update` gets 1 at rest (the wall with the words in) and 1 to 2 across the close (`aspirantsS` in
 * `hero/timeline.ts`). In the lead (the hero's zone) it is negative and the hero drives the scene.
 * The ground stays light, with nothing behind the wall (`sections/backdrops.ts`).
 */
/** Screens of rest on the wall with the words (the pictures only slide with the scroll). */
export const ASPIRANTS_REST = 1;
/** The close: the length of the scroll zone, in screens. */
export const ASPIRANTS_CLOSE = 1;
/** The section's length in screens. */
export const ASPIRANTS_SCREENS = ASPIRANTS_REST + ASPIRANTS_CLOSE;
/** The idle snap for a full traverse of the close (seconds): the page carries the scene the rest of the way. */
export const ASPIRANTS_SNAP_SECONDS = 1.6;

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
    {
      at: ASPIRANTS_REST / ASPIRANTS_SCREENS,
      span: ASPIRANTS_CLOSE / ASPIRANTS_SCREENS,
      from: 1,
      to: 2,
      seconds: ASPIRANTS_SNAP_SECONDS,
      ease: "linear",
    },
  ],
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
