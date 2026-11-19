import { playsOf } from "../../kernel/beat";
import type { HomeSection } from "../../kernel/types";
import { frameRestScreens, LIST_LAST, LIST_SCREENS, LIST_STEPS } from "../hand/stations";

import { preload } from "./preload";

/**
 * The list of ten frames, one zone each (`../hand/stations.ts`): the toss onto the first frame, nine
 * turns of the strip, the growth of Selena's frame, all played by the scroll, up and down, with a rest
 * on every frame. Length, lead and tail are in screens.
 */
export const section: HomeSection = {
  id: "list",
  screens: LIST_SCREENS,
  lead: 0.4,
  tail: 0.5,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  plays: playsOf(0, LIST_LAST, LIST_SCREENS, LIST_STEPS),
  // A control that takes the focus from far away brings the page to the first frame's rest (the idle
  // snap would otherwise move a page that landed inside a zone); the frame's own control then moves it.
  focus: frameRestScreens(0) / LIST_SCREENS,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
