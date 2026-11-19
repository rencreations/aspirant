import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { DESCENT_LEAD, DESCENT_SCREENS } from "./stations";

/**
 * The descent (round six, 20 Nov 2026): the passage from the strip to the character section. The
 * normal drone, with the Obsidia doll sitting on its head, comes in from above while the strip's film
 * is still flying off to the lower right, and the two dance and fly slowly DOWN, as the visitor
 * scrolls, to the character section, which rises from the bottom of the screen over the last
 * `LIST_LEAD` screens (the list's lead). At the end they dock at the bottom right.
 *
 * It is a plain scroll linked section: no plays, so nothing rests in it, the idle snap and the joint
 * snap keep out of it (`kernel/snap.ts`), and the visitor can scrub it both ways. `update` gets the
 * scroll's `local`; `u = local * screens` is the screens from the start (negative in the lead).
 */
export const section: HomeSection = {
  id: "descent",
  screens: DESCENT_SCREENS,
  lead: DESCENT_LEAD,
  tail: 0,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  // The pair are built in pauses of the scroll, well before they show (the doll's programs cost a few
  // hundred milliseconds): the strip is about four screens of scroll.
  mountAhead: 6,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
