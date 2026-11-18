import { playsOf } from "../../kernel/beat";
import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { BOLT_LAST, BOLT_STEPS } from "./stations";

/** The length in screens: the last threshold (2.1) clears the fall's lead of half a screen. */
const SCREENS = 2.7;

/**
 * Silverbolt, the doll and the five pairs, as triggered scenes (`stations.ts`): the arrival, then one
 * turn of the wheel for each pair. Length, lead and tail are in screens. The ground is the storm
 * ground and the live backdrop (`backdrop-plan.ts`) gives the section its green. It has no tail:
 * the fall's lead takes the scene over from the last station, with the same picture, so the two
 * never draw different moments.
 */
export const section: HomeSection = {
  id: "bolt",
  screens: SCREENS,
  lead: 0.5,
  tail: 0,
  bg: "storm",
  nav: { theme: "storm" },
  dom: "fixed",
  plays: playsOf(0, BOLT_LAST, SCREENS, BOLT_STEPS),
  // The dragon, the doll and the shared lit scene are built in pauses of the scroll, long before the
  // dragon shows (the environment map and the programs cost a few hundred milliseconds each).
  mountAhead: 9,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
