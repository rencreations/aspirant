import { playsOf } from "../../kernel/beat";
import type { HomeSection } from "../../kernel/types";
import { BEAT, BOLT_LAST, FALL_SCREENS, FALL_STEPS } from "../bolt/stations";

import { preload } from "./preload";

/**
 * The doll is thrown and falls: two scroll zones (`../bolt/stations.ts`), the throw and the fall to
 * "5 Phases", then the rest of the fall to "10 Characters". Length, lead and tail are in screens. It has
 * no tail: the hand's lead (the fingertips coming up) is the last half screen of this section, and the
 * doll goes from this scene to the hand's on the same picture (joint J6).
 */
export const section: HomeSection = {
  id: "fall",
  screens: FALL_SCREENS,
  lead: 0.5,
  tail: 0,
  bg: "storm",
  nav: { theme: "storm" },
  dom: "fixed",
  plays: playsOf(BOLT_LAST, BEAT.end, FALL_SCREENS, FALL_STEPS),
  // Its lead is the bolt's last rest drawn again (the same moment), so the lead is not a joint to snap in.
  restOutside: true,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
