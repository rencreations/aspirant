import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";

/** Tetra bends the pictures. Length, lead and tail are in screens (design section 4). */
export const section: HomeSection = {
  id: "bend",
  screens: 9,
  lead: 0.5,
  tail: 0.5,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  dom: "fixed",
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
