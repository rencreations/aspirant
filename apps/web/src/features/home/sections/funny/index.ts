import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";

/** Tetra, the kite and the two drones. Length, lead and tail are in screens (design section 4). */
export const section: HomeSection = {
  id: "funny",
  screens: 4.2,
  lead: 0.5,
  tail: 0.5,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  // The words are in from local 0.64 and ride up from 0.8: a focus on the button lands between.
  focus: 0.7,
  dom: "fixed",
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
