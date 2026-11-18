import { chunkItem, type PreloadItem } from "@/lib/preload";

import { coverItems } from "./covers";

/**
 * What the crate needs: its script (the actor, one lazy chunk) and the music room's data and the
 * covers of the first tracks (about 0.5 MB for seven). The crate, the sleeves, the disc and its
 * grooves are code. The actor reads the covers from the same cache the item fills, so a visit that
 * never ran this list still works.
 *
 * The music section is far down the page, so the default is `deferred`. Pass `deferred: false`
 * where a page waits for it, and `count` for the number of sleeves (the room has seven tracks with
 * covers today; the crate takes up to twelve).
 */
export function recordsItems(
  options: { count?: number; deferred?: boolean; priority?: number } = {},
): PreloadItem[] {
  const deferred = options.deferred ?? true;
  const priority = options.priority ?? 46;
  const script: PreloadItem = chunkItem(
    "home-records",
    "Sleeving the records",
    () => import("./index"),
  );
  return [
    deferred ? { ...script, deferred: true, priority } : script,
    ...coverItems({ ...options, deferred, priority }),
  ];
}
