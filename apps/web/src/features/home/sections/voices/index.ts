import { PASSAGE_SPEED } from "../../kernel/speed";
import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { VOICES_PLAYS, VOICES_SCREENS } from "./stations";

/**
 * The chooser and the voice lines: a way in that plays by itself when Selena's white has covered the
 * screen, a long rest in which nothing moves by the scroll, and a way out by the scroll
 * (`stations.ts`). Length, lead and tail are in screens.
 */
export const section: HomeSection = {
  id: "voices",
  screens: VOICES_SCREENS,
  lead: 0.5,
  tail: 0.5,
  // Built while the visitor is still in Selena's section, so the drones are made and the art is in
  // (the way in waits for her picture, `runtime.ts` `ready`) long before her white covers the screen.
  mountAhead: 3,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  plays: VOICES_PLAYS,
  // The rest is held to the passage's speed too (25 Nov 2026). The way in, in the lead, is in Selena's
  // section, which has its own.
  topSpeed: [{ from: 0, to: VOICES_SCREENS, speed: PASSAGE_SPEED }],
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
