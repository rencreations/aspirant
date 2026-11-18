import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";

/** the chooser and the voice lines. Length, lead and tail are in screens (design section 4). */
export const section: HomeSection = {
  id: "voices",
  screens: 2.4,
  lead: 0.5,
  tail: 0.5,
  bg: "daybreak",
  // The screen goes white before the section starts: the bar's ink turns with it.
  nav: { theme: "daybreak", early: 0.45 },
  dom: "fixed",
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
