import type { PreloadItem } from "@/lib/preload";

import { dollItems } from "../../actors/doll/preload";
import { duoItems } from "../../actors/duo/preload";
import { silverboltItems } from "../../actors/silverbolt/preload";
import { tetraItems } from "../../actors/tetra/preload";

/**
 * What the funny section needs: the four actors of its scene (Tetra with her kite, Silverbolt, the
 * doll, the two drones). The section is far down the page, so all of it is `deferred`: it arrives in
 * the background, in the order the visitor reaches it, and the scene shows nothing of an actor that
 * is not here yet. The marks are drawn by a shader and load nothing.
 */
export function preload(): PreloadItem[] {
  return [...tetraItems(), ...silverboltItems(), ...dollItems(), ...duoItems()];
}
