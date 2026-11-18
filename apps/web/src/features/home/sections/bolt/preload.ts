import type { PreloadItem } from "@/lib/preload";

import { dollItems } from "../../actors/doll/preload";
import { silverboltItems } from "../../actors/silverbolt/preload";

/**
 * What the bolt and the fall sections need: Silverbolt (its script and its model, 0.3 MB) and the
 * doll (1.1 MB). The visitor reaches them at about eleven screens, so both are deferred, behind the
 * strip's clips and ahead of the hand and Selena. The comic marks, the trails and the lines are code in
 * the engine chunk. Until the dragon has arrived the section shows a quiet stage and its text goes on.
 */
export function preload(): PreloadItem[] {
  return [...silverboltItems({ priority: 36 }), ...dollItems({ priority: 37 })];
}
