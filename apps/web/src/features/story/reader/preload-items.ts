import { characters } from "@/content/characters";
import { imageItem, type PreloadItem } from "@/lib/preload";

import { portraitFor } from "./portraits";

/**
 * The small portraits beside the names of "Before you begin" at the top of Part One. They are a
 * few screens down and lazy, so they download in the background once the page is open.
 */
export function readerItems(): PreloadItem[] {
  return characters.flatMap((c) => {
    const art = portraitFor(c.slug);
    return art
      ? [{ ...imageItem(art.src, "Loading the portraits", 1), deferred: true, priority: 20 }]
      : [];
  });
}
