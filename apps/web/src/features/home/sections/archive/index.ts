import { LOWER_PASSAGE_SPEED } from "../../kernel/speed";
import type { HomeSection } from "../../kernel/types";

import { ARCHIVE_PLAYS, ARCHIVE_SCREENS, ENTRY_AT, ENTRY_SCREENS, EXIT_SCREENS } from "./plays";
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
  // A top scene speed (25 Nov 2026): Tetra's wave and run and the drone's arc over the first cover play
  // whole, the tour and the way out are not skipped, and the card of the footer is never thrown up.
  topSpeed: [
    { from: 0, to: ARCHIVE_SCREENS, speed: LOWER_PASSAGE_SPEED },
    { from: ENTRY_AT, to: ENTRY_AT + ENTRY_SCREENS, speed: 0.9 },
    { from: ENTRY_AT + ENTRY_SCREENS, to: ARCHIVE_SCREENS - EXIT_SCREENS, speed: 1.5 },
    { from: ARCHIVE_SCREENS - EXIT_SCREENS, to: ARCHIVE_SCREENS, speed: 1.2 },
  ],
  plays: ARCHIVE_PLAYS,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
