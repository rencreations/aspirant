import { playsOf } from "../../kernel/beat";
import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { HAND_LAST, HAND_SCREENS, HAND_STEPS } from "./stations";

/**
 * Selena's hand and the doll, as one scroll zone (`stations.ts`): the hand rises, she lands in the
 * palm and sits, the words come in. Then a long rest on the words, and the join with the list. Length,
 * lead and tail are in screens (design section 4).
 */
export const section: HomeSection = {
  id: "hand",
  screens: HAND_SCREENS,
  lead: 0.5,
  tail: 0.4,
  bg: "storm",
  nav: { theme: "storm" },
  dom: "fixed",
  plays: playsOf(0, HAND_LAST, HAND_SCREENS, HAND_STEPS),
  // The hand and Selena are built in pauses of the scroll, long before they show. The page before the
  // hand is short, so five screens ahead keeps their build out of the page's opening.
  mountAhead: 5,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
