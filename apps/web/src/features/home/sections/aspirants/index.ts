import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";

/** the sliding wall of wide cards. Length, lead and tail are in screens (design section 4). */
export const section: HomeSection = {
  id: "aspirants",
  screens: 1.6,
  lead: 0.5,
  tail: 0.5,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
