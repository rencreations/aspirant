import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { VOICES_PLAYS } from "./stations";

/**
 * The chooser and the voice lines, as an entrance and a leave (`stations.ts`) around a long rest in
 * which nothing moves by the scroll. Length, lead and tail are in screens.
 */
export const section: HomeSection = {
  id: "voices",
  screens: 1.5,
  lead: 0.5,
  tail: 0.5,
  bg: "daybreak",
  // The screen goes white before the section starts: the bar's ink turns with it.
  nav: { theme: "daybreak", early: 0.45 },
  dom: "fixed",
  plays: VOICES_PLAYS,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
