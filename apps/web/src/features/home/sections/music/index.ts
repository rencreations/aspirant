import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { MUSIC_PLAYS, MUSIC_SCREENS } from "./stations";

/**
 * The gramophone and the records, as two scroll zones (`stations.ts`): the props come in with the
 * scroll, the visitor picks records while the page rests, and the props leave with the scroll on the
 * way out. Nothing holds the page. Length, lead and tail are in screens.
 */
export const section: HomeSection = {
  id: "music",
  screens: MUSIC_SCREENS,
  lead: 0.5,
  tail: 0.5,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  plays: MUSIC_PLAYS,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
