import type { HomeSection } from "../../kernel/types";

import { STRIP_SCREENS } from "./journey";
import { preload } from "./preload";

/**
 * The psychoactive hero: the ultra wide frame with its words, its expand to the window, the pull into
 * the orbit of the ten films and, in the tail, the whole set flying off to the bottom right. The
 * tail is long (1.2 screens) because the fly-off is the start of what comes next: it carries on into
 * the bolt section's lead. Length, lead and tail are in screens (design section 4).
 */
export const section: HomeSection = {
  id: "strip",
  screens: STRIP_SCREENS,
  lead: 0.5,
  tail: 1.2,
  bg: "storm",
  nav: { theme: "storm" },
  dom: "fixed",
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
