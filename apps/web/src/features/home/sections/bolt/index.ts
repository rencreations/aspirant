import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";

/**
 * Silverbolt, the doll and the five pairs. Length, lead and tail are in screens (design section 4).
 * The ground is the storm ground; the dark green-black of the section is a layer of its own in the
 * below slot (`bolt.module.css` `.tint`), faded by the runtime. The kernel's cross-fade between two
 * opaque grounds shows the page through the middle of the joint as a grey wash, so no joint of this
 * pair crosses grounds.
 */
export const section: HomeSection = {
  id: "bolt",
  screens: 4,
  lead: 0.5,
  tail: 0.5,
  bg: "storm",
  nav: { theme: "storm" },
  dom: "fixed",
  // The dragon, the doll and the shared lit scene are built in pauses of the scroll, long before the
  // dragon shows (the environment map and the programs cost a few hundred milliseconds each).
  mountAhead: 9,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
