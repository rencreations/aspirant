import { PASSAGE_SPEED } from "../../kernel/speed";
import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { VOICES_PLAYS, VOICES_SCREENS } from "./stations";

/**
 * The chooser and the voice lines, as an entrance and a leave (`stations.ts`, scroll zones) around a
 * long rest in which nothing moves by the scroll. Length, lead and tail are in screens.
 */
export const section: HomeSection = {
  id: "voices",
  screens: VOICES_SCREENS,
  lead: 0.5,
  tail: 0.5,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  plays: VOICES_PLAYS,
  // The white after Selena's way out, the way in and the rest are held to the passage's speed too (25 Nov
  // 2026): a hard scroll from her film cannot leap over the trigger of the way in.
  topSpeed: [{ from: 0, to: VOICES_SCREENS, speed: PASSAGE_SPEED }],
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
