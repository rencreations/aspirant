import { playsOf } from "../../kernel/beat";
import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { HAND_LAST, HAND_STEPS } from "./stations";

/**
 * The length in screens: the play fires 0.2 in, then about 0.8 of rest with the fingers live, then
 * the join with the list (the hand comes down, the words leave, the frame arrives).
 */
const SCREENS = 1.4;

/**
 * Selena's hand and the doll, as one triggered scene (`stations.ts`): the hand rises, she lands in the
 * palm and sits, the words come in. Length, lead and tail are in screens (design section 4).
 */
export const section: HomeSection = {
  id: "hand",
  screens: SCREENS,
  lead: 0.5,
  tail: 0.4,
  bg: "storm",
  nav: { theme: "storm" },
  dom: "fixed",
  plays: playsOf(0, HAND_LAST, SCREENS, HAND_STEPS),
  // The hand and Selena are built in pauses of the scroll, long before they show. The page before the
  // hand is short now, so five screens ahead keeps their build out of the page's opening.
  mountAhead: 5,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
