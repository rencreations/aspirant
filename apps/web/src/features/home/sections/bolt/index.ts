import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";

/** Silverbolt, the doll and the five pairs. Length, lead and tail are in screens (design section 4). */
export const section: HomeSection = {
  id: "bolt",
  screens: 4,
  lead: 0.5,
  tail: 0.5,
  bg: "#07130f",
  nav: { theme: "storm" },
  dom: "fixed",
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
