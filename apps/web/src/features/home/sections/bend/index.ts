import type { HomeSection } from "../../kernel/types";

import { BEND_PLAYS, BEND_SCREENS } from "./plays";
import { preload } from "./preload";

/** Tetra bends the pictures: ten scroll zones with a rest after each (`plays.ts`). */
export const section: HomeSection = {
  id: "bend",
  screens: BEND_SCREENS,
  lead: 0.5,
  // Short: the archive takes Tetra and the drone from its own start, and a longer tail would draw her again after she has run off.
  tail: 0.3,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  plays: BEND_PLAYS,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
