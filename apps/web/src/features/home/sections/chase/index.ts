import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";

/** the chase and the comic. Length, lead and tail are in screens (design section 4). */
export const section: HomeSection = {
  id: "chase",
  screens: 4,
  lead: 0.5,
  tail: 0.5,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
