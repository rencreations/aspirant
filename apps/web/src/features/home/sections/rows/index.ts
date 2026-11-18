import type { HomeSection } from "../../kernel/types";

import { ROWS_SCREENS } from "./journey";
import { preload } from "./preload";

/**
 * The angled rows, the small film and its turn into the strip. The ground is the dark one from the
 * start of the section (the kernel's cross-fade at the joint with the aspirants), so the strip stands
 * on it at joint J3. Length, lead and tail are in screens (design section 4).
 */
export const section: HomeSection = {
  id: "rows",
  screens: ROWS_SCREENS,
  lead: 0.5,
  tail: 0.5,
  bg: "storm",
  nav: { theme: "storm" },
  dom: "fixed",
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
