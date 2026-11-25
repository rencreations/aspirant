import { LOWER_PASSAGE_SPEED } from "../../kernel/speed";
import type { HomeSection } from "../../kernel/types";

import { BEND_PLAYS, BEND_SCREENS, BEND_SPEED, ZONE_SCREENS } from "./plays";
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
  manualScroll: true,
  // A top scene speed through every zone (25 Nov 2026): the poses and the pictures that fly in play whole
  // whatever the visitor does, up to the zone that takes Tetra and the drone to the archive.
  // The whole passage, rests included, then each zone slower (25 Nov 2026).
  topSpeed: [
    { from: 0, to: BEND_SCREENS, speed: LOWER_PASSAGE_SPEED },
    ...ZONE_SCREENS.map((z) => ({ from: z.at, to: z.at + z.len, speed: BEND_SPEED })),
  ],
  plays: BEND_PLAYS,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
