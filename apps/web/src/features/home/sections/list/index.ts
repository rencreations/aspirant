import { playsOf } from "../../kernel/beat";
import { PASSAGE_SPEED } from "../../kernel/speed";
import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { frameRestScreens, LIST_LAST, LIST_LEAD, LIST_SCREENS, LIST_STEPS } from "./stations";

/**
 * The characters, as the oryzo.ai strip (round six, `stations.ts`): the heading and the strip rise
 * from the bottom of the screen in the lead while the pair descends, the strip turns one frame at a
 * time (a scroll zone for each, up and down, with a rest on every frame), and the last frame, Selena
 * in 3D, grows into the whole screen. Length, lead and tail are in screens. The lead is the last part
 * of the descent (`../descent/stations.ts`).
 */
export const section: HomeSection = {
  id: "list",
  screens: LIST_SCREENS,
  lead: LIST_LEAD,
  tail: 0.5,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  plays: playsOf(0, LIST_LAST, LIST_SCREENS, LIST_STEPS),
  // The whole strip has a top speed, the rests between its turns too (25 Nov 2026): a hard scroll cannot
  // leap past a frame or past the growth of the last one (which has its own, lower, in the engine).
  topSpeed: [{ from: 0, to: LIST_SCREENS, speed: PASSAGE_SPEED }],
  // A control that takes the focus from far away brings the page to the first frame's rest (the idle
  // snap would otherwise move a page that landed inside a zone); the frame's own control then moves it.
  focus: frameRestScreens(0) / LIST_SCREENS,
  // Selena is the biggest file of the page: the section is built long before the strip reaches her.
  mountAhead: 8,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
