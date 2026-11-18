import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";

/** angled rows and the small video. Length, lead and tail are in screens (design section 4). */
export const section: HomeSection = {
  id: "rows",
  screens: 2.4,
  lead: 0.5,
  tail: 0.5,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
