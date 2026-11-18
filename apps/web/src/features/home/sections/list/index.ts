import { LIST_SCREENS } from "../hand/timeline";
import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";

/** the list of ten frames. Length, lead and tail are in screens (design section 4). */
export const section: HomeSection = {
  id: "list",
  screens: LIST_SCREENS,
  lead: 0.5,
  tail: 0.5,
  bg: "storm",
  nav: { theme: "storm" },
  dom: "fixed",
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
