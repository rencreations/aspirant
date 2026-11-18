import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";

/** Selena's hand and the doll. Length, lead and tail are in screens (design section 4). */
export const section: HomeSection = {
  id: "hand",
  screens: 3.4,
  lead: 0.5,
  tail: 0.5,
  bg: "storm",
  nav: { theme: "storm" },
  dom: "fixed",
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
