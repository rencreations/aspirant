import { playsOf } from "../../kernel/beat";
import type { HomeSection } from "../../kernel/types";
import { LIST_LAST, LIST_STEPS } from "../hand/stations";

import { preload } from "./preload";

/**
 * The length in screens: the toss fires half a screen in (after the hand's tail), then a dwell of
 * 0.4 of a screen for each frame, the growth of the last frame, and a rest before the tail.
 */
const SCREENS = 5;

/**
 * The list of ten frames, one play each (`../hand/stations.ts`): the toss onto the first frame, nine
 * turns of the strip, the growth of Selena's frame. Length, lead and tail are in screens.
 */
export const section: HomeSection = {
  id: "list",
  screens: SCREENS,
  lead: 0.4,
  tail: 0.5,
  bg: "storm",
  nav: { theme: "storm" },
  dom: "fixed",
  plays: playsOf(0, LIST_LAST, SCREENS, LIST_STEPS),
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
