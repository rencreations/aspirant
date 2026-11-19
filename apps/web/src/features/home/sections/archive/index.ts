import type { HomeSection } from "../../kernel/types";

import { ARCHIVE_PLAYS, ARCHIVE_SCREENS } from "./plays";
import { preload } from "./preload";

/**
 * The collection and the drone, scroll linked from end to end: the entry (Tetra waves and runs off,
 * the drone flies up, the covers rise), the tour of the ten covers, and the way out (`plays.ts`). The
 * entry is a scroll zone, so the page finishes it by itself when the visitor stops inside it; the
 * tour is a list the visitor drives and has no snap.
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
