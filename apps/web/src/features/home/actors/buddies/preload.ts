import type { PreloadItem } from "@/lib/preload";

import { dollItems } from "../doll/preload";
import { droneItems } from "../drone/preload";

/**
 * What the pair needs: the drone's list and the doll's (the pair's own code is in the drone's and the
 * doll's chunks and the one lazy chunk of the section that mounts it). Deferred unless a section says
 * `deferred: false` where the pair is in view when the page opens.
 */
export function buddiesItems(
  options: { deferred?: boolean; priority?: number } = {},
): PreloadItem[] {
  return [...droneItems(options), ...dollItems(options)];
}
