import { chunkItem, type PreloadItem } from "@/lib/preload";

import { SECTIONS } from "./kernel/sections";
import { aggregateItems } from "./kernel/preload";

/**
 * What the home page needs before it opens, and what keeps downloading after. The lazy engine (the
 * stage, the clock, the runner) is waited for, then every section's own list in scroll order: the
 * first screen is waited for, the rest is `deferred` and arrives in the background by priority.
 * `lib/route-preloads.ts` calls this for `/`, so the loading screen and the page change use it too.
 *
 * Only data and constants are imported here (never a runtime or three.js): this file is in the
 * bundle of every page.
 */
export function homeItems(): PreloadItem[] {
  return [
    chunkItem("home-engine", "Starting the stage", () => import("./kernel/engine"), 3),
    ...aggregateItems(SECTIONS),
  ];
}
