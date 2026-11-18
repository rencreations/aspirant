import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";

/** the ultra wide frame and its expand. Length, lead and tail are in screens (design section 4). */
export const section: HomeSection = {
  id: "strip",
  screens: 3.1,
  lead: 0.5,
  tail: 0.5,
  bg: "storm",
  nav: { theme: "storm" },
  dom: "fixed",
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
