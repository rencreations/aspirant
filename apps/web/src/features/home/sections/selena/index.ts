import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { SELENA_SCREENS } from "./timeline";

/**
 * Selena and the dragon in the drawer's room, then the film. Length, lead and tail are in screens
 * (design section 4). The ground is the dark one the list ends on; the section's own white layer
 * covers it from the dragon's pass to the first screen of the voices.
 */
export const section: HomeSection = {
  id: "selena",
  screens: SELENA_SCREENS,
  lead: 0.5,
  tail: 0.5,
  bg: "storm",
  nav: { theme: "storm" },
  dom: "fixed",
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
