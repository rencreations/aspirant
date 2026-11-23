import type { HomeSection } from "../../kernel/types";

import { ARCHIVE_PLAYS, ARCHIVE_SCREENS } from "./plays";
import { preload } from "./preload";

/** The entry, cover tour and exit all follow the visitor's scroll. */
export const section: HomeSection = {
  id: "archive",
  screens: ARCHIVE_SCREENS,
  lead: 0.5,
  tail: 0.5,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  manualScroll: true,
  plays: ARCHIVE_PLAYS,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
