import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { VOICES_PLAYS, VOICES_SCREENS } from "./stations";

/**
 * The chooser and the voice lines, as an entrance and a leave (`stations.ts`, scroll zones) around a
 * long rest in which nothing moves by the scroll. Length, lead and tail are in screens.
 */
export const section: HomeSection = {
  id: "voices",
  screens: VOICES_SCREENS,
  lead: 0.5,
  tail: 0.5,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  plays: VOICES_PLAYS,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
