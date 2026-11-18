import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";

/** the doll falls: 5 Phases, 10 Characters. Length, lead and tail are in screens (design section 4). */
export const section: HomeSection = {
  id: "fall",
  screens: 2.6,
  lead: 0.5,
  tail: 0.5,
  bg: "storm",
  nav: { theme: "storm" },
  dom: "fixed",
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
