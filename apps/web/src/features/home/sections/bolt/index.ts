import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { BOLT_LEAD, BOLT_SCREENS } from "./stations";

/**
 * Silverbolt, the doll and the five pairs (round four, 20 Nov 2026): plain scroll, no zones, no plays,
 * no idle snap and no wait. The dragon flies in a straight diagonal in a side view, its head crawls
 * through the middle while the text wheel turns with the scroll (a continuous wheel like the
 * tibdigital.com "Since 2007" one), a white rises from the bottom while the strip's pale blue ink field
 * thins out (light mode only, round five), and at the end of the slow range the dragon shakes and the
 * doll loses her grip. The section has no tail: the fall's lead takes the scene over, with the same
 * picture (both read `u`, the scroll since this section's start).
 */
export const section: HomeSection = {
  id: "bolt",
  screens: BOLT_SCREENS,
  lead: BOLT_LEAD,
  tail: 0,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  // The dragon, the doll and the shared lit scene are built in pauses of the scroll, long before the
  // dragon shows (the environment map and the programs cost a few hundred milliseconds each).
  mountAhead: 9,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
