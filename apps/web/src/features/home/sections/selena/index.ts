import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { SELENA_PLAYS } from "./stations";

/**
 * Selena and the dragon in the drawer's room, then the film. Two plays (`stations.ts`): the room
 * comes in, then the film runs on a clock while the page is held. The ground is the dark one the
 * list ends on; the section's own white layer covers it from the dragon's pass to the first screen
 * of the voices. The actors are the biggest files of the page, so the section mounts far ahead.
 */
export const section: HomeSection = {
  id: "selena",
  screens: 1.5,
  lead: 0.5,
  tail: 0.5,
  mountAhead: 3.5,
  bg: "storm",
  nav: { theme: "storm" },
  dom: "fixed",
  plays: SELENA_PLAYS,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
