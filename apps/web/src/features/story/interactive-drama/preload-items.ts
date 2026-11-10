import { imageItem, type PreloadItem } from "@/lib/preload";

import { dramaPoster } from "@/features/character/vexana/drama/drama-media";
import { DRAMA_START, nodeById } from "@/features/character/vexana/drama/drama-graph";

/**
 * What the drama page needs before it opens: the title picture. The episodes themselves load when
 * they are played.
 */
export function dramaPageItems(): PreloadItem[] {
  return [imageItem(dramaPoster(nodeById(DRAMA_START).file), "Loading the interactive drama", 2)];
}
