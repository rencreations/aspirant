import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { MUSIC_PLAYS, MUSIC_SCREENS } from "./stations";

/**
 * The vinyl and the track lists arrive and leave with the scroll. Both drones meet the
 * neighboring scenes at their shared stations.
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
