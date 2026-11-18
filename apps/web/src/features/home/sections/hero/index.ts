import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";

/** splash cards, the logo and its wave. Length, lead and tail are in screens (design section 4). */
export const section: HomeSection = {
  id: "hero",
  screens: 4.2,
  lead: 0,
  tail: 0.5,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
