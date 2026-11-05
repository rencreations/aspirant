import { imageItem, type PreloadItem } from "@/lib/preload";
import { libUrl } from "@/lib/library";

import { COLLECTIONS } from "../registry";

/** What the shelf needs on first paint: the ten covers. The scene's code chunk is added by the shelf itself. */
export function shelfItems(): PreloadItem[] {
  return COLLECTIONS.map((c) => imageItem(libUrl(c.cover), `Loading the ${c.name} cover`, 2));
}
