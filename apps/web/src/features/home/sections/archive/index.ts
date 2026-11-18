import type { HomeSection } from "../../kernel/types";

import { ARCHIVE_PLAYS, ARCHIVE_SCREENS } from "./plays";
import { preload } from "./preload";

/**
 * The collection and the drone: one triggered entry (Tetra waves and runs off, the drone flies up,
 * the covers rise), then the tour and the way out follow the scroll (`plays.ts`).
 */
export const section: HomeSection = {
  id: "archive",
  screens: ARCHIVE_SCREENS,
  lead: 0.5,
  tail: 0.5,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  plays: ARCHIVE_PLAYS,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
