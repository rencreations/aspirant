import type { HomeSection } from "../../kernel/types";
import { FALL_LEAD, FALL_SCREENS } from "../bolt/stations";

import { preload } from "./preload";

/**
 * The doll falls (round four): plain scroll, no zones and no plays. Her place and the camera ease in
 * and out from where she let go to the middle of the screen, then FIVE | PHASES and TEN | HEROES come
 * in once she is centred and the camera is still. Length, lead and tail are in screens. The tail is a
 * little over the hand's lead so the last frame of the section is written (the white goes back down).
 */
export const section: HomeSection = {
  id: "fall",
  screens: FALL_SCREENS,
  lead: FALL_LEAD,
  tail: 0.3,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
