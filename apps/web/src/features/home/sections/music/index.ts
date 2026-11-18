import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { MUSIC_PLAYS } from "./stations";

/**
 * The gramophone and the records, as two played scenes (`stations.ts`): the props come in while the
 * page is held, the visitor picks records while it is free, and the props leave on the way out.
 * Length, lead and tail are in screens.
 */
export const section: HomeSection = {
  id: "music",
  screens: 1.7,
  lead: 0.5,
  tail: 0.5,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  plays: MUSIC_PLAYS,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
