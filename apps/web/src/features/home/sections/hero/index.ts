import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";

/**
 * The logo and the splash cards (premotio's hero). Length, lead and tail are in screens (design
 * section 4). `carry`: a jump past the hero replays its end, which gives the bar its own logo.
 */
export const section: HomeSection = {
  id: "hero",
  screens: 4.2,
  lead: 0,
  tail: 0.5,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  carry: true,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
