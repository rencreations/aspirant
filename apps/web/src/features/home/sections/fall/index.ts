import { playsOf } from "../../kernel/beat";
import type { HomeSection } from "../../kernel/types";
import { BEAT, BOLT_LAST, FALL_STEPS } from "../bolt/stations";

import { preload } from "./preload";

/** The length in screens: the throw fires 0.2 in, then half a screen of rest before the hand's lead. */
const SCREENS = 1.2;

/**
 * The doll is thrown and falls: one scene of about three seconds, then "10 Characters" stands.
 * Length, lead and tail are in screens. It has no tail: the hand's lead (the fingertips coming up)
 * is the last half screen of this section, and the doll goes from this scene to the hand's on the
 * same picture (joint J6).
 */
export const section: HomeSection = {
  id: "fall",
  screens: SCREENS,
  lead: 0.5,
  tail: 0,
  bg: "storm",
  nav: { theme: "storm" },
  dom: "fixed",
  plays: playsOf(BOLT_LAST, BEAT.end, SCREENS, FALL_STEPS),
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
