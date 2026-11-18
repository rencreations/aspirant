import { useHomeFlow } from "@/lib/home-flow";
import { chunkItem, type PreloadItem } from "@/lib/preload";

import { afterTheDrone, droneTier, introTier } from "./boot/preload";
import { SECTIONS } from "./kernel/sections";
import { aggregateItems } from "./kernel/preload";

/**
 * What the home page needs before it opens, and what keeps downloading after. The lazy engine (the
 * stage, the clock, the runner) is waited for, then every section's own list in scroll order: the
 * first screen is waited for, the rest is `deferred` and arrives in the background by priority.
 * `lib/route-preloads.ts` calls this for `/`, so the loading screen and the page change use it too.
 *
 * A document load of the home runs the opening (the drone that waits, then the intro that carries
 * the logo in): its files go FIRST, all waited for, so the drone can appear while the rest arrives
 * and the intro never waits for a file after the press (`boot/preload.ts`). Any other way into the
 * home (the curtain, probes with the intro off) has no opening and skips them: the sections ask for
 * what they show, and the pair of drones comes later, deferred.
 *
 * Only data and constants are imported here (never a runtime or three.js): this file is in the
 * bundle of every page.
 */
export function homeItems(): PreloadItem[] {
  const engine = chunkItem("home-engine", "Starting the stage", () => import("./kernel/engine"), 3);
  const rest = aggregateItems(SECTIONS);
  const flow = useHomeFlow.getState();
  if (flow.arrival !== "document" || flow.phase === "open") return [engine, ...rest];
  // The opening's items are waited for and win over a deferred copy a section may list. The drone
  // comes first (its files, the stage and the opening's scene), then the pair, the logo and every
  // section's first screen: they start when the drone's files are in, so a slow link shows the
  // drone early instead of at the very end.
  const first = [...droneTier(), engine];
  const intro = introTier();
  const taken = new Set([...first, ...intro].map((item) => item.id));
  return afterTheDrone(first, [...intro, ...rest.filter((item) => !taken.has(item.id))]);
}
