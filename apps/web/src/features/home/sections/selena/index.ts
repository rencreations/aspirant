import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { SELENA_FOCUS, SELENA_PLAYS, SELENA_SCREENS } from "./stations";

/**
 * Selena and the dragon in the drawer's room, then the film. Two scroll zones (`stations.ts`): the
 * room comes in with the scroll, stands for a rest, then the film plays with the scroll, both ways,
 * and the kernel finishes a zone the visitor leaves half way. The ground is the dark one the list
 * ends on; the section's own white layer covers it from the dragon's pass to the first screen of the
 * voices. The actors are the biggest files of the page, so the section mounts far ahead.
 */
export const section: HomeSection = {
  id: "selena",
  screens: SELENA_SCREENS,
  lead: 0.5,
  tail: 0.5,
  mountAhead: 3.5,
  // The middle of the rest: the drawer, its words and the button all show there.
  focus: SELENA_FOCUS,
  bg: "storm",
  nav: { theme: "storm" },
  dom: "fixed",
  plays: SELENA_PLAYS,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
