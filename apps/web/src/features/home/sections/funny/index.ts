import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { FUNNY_PLAYS } from "./stations";

/**
 * Tetra, the kite and the two drones, as three played scenes (`stations.ts`). The tail is long
 * enough for the page to ride the duo and the words out of the screen (scroll linked).
 */
export const section: HomeSection = {
  id: "funny",
  screens: 2,
  lead: 0.5,
  tail: 0.8,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  // The words are in at the last station (the section's end is the rest): a focus lands there.
  focus: 0.85,
  dom: "fixed",
  plays: FUNNY_PLAYS,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
