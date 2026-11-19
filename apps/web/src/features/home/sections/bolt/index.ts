import { playsOf } from "../../kernel/beat";
import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { BOLT_LAST, BOLT_SCREENS, BOLT_STEPS } from "./stations";

/**
 * Silverbolt, the doll and the five pairs, as scroll zones (`stations.ts`): the arrival, then one
 * turn of the wheel for each pair, each played by the scroll, up and down. Length, lead and tail are in
 * screens. The ground is the storm ground and the live backdrop (`backdrop-plan.ts`) gives the section
 * its green. It has no tail: the fall's lead takes the scene over from the last rest, with the same
 * picture, so the two never draw different moments.
 */
export const section: HomeSection = {
  id: "bolt",
  screens: BOLT_SCREENS,
  lead: 0.5,
  tail: 0,
  bg: "storm",
  nav: { theme: "storm" },
  dom: "fixed",
  plays: playsOf(0, BOLT_LAST, BOLT_SCREENS, BOLT_STEPS),
  // The dragon, the doll and the shared lit scene are built in pauses of the scroll, long before the
  // dragon shows (the environment map and the programs cost a few hundred milliseconds each).
  mountAhead: 9,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
