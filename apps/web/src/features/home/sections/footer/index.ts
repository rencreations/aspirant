import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";

/** the footer and the way to About. Length, lead and tail are in screens (design section 4). */
export const section: HomeSection = {
  id: "footer",
  screens: 1.2,
  lead: 0.5,
  tail: 0,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "flow",
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
