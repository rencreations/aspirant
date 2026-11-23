import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { FUNNY_FOCUS, FUNNY_SCREENS } from "./stations";

/**
 * Tetra, the kite and the two drones, as three scroll zones (`stations.ts`). The tail is long
 * enough for the page to ride the duo and the words out of the screen (scroll linked).
 */
export const section: HomeSection = {
  id: "funny",
  screens: FUNNY_SCREENS,
  lead: 1,
  tail: 0.8,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  // The words are in at the last station (the last rest): a focus lands in the middle of it.
  focus: FUNNY_FOCUS,
  dom: "fixed",
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
