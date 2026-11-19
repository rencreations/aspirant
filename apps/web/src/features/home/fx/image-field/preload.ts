import { chunkItem, type PreloadItem } from "@/lib/preload";

import { bitmapItem } from "./bitmaps";
import { portraitSource, setDef, wideSource, type FieldSetName, type PicSource } from "./sets";

export interface FieldItemOptions {
  /**
   * The wide pictures are only seen from the land of the hero on. "waited" (the default, as the
   * design says: the wall is ready when it comes) holds the loading bar for them. "deferred"
   * loads them behind everything else, and a card shows its portrait until its wide picture is in.
   */
  wide?: "waited" | "deferred";
  /** The priority of the deferred wide pictures (smaller first). */
  priority?: number;
}

/**
 * Many small pictures as one item: the bar counts all their bytes, and one entry in the list does not
 * crowd it (the wall's extra thumbnails are fifty pictures of 15 KB). Each is kept in the store.
 */
function bundleItem(id: string, sources: readonly PicSource[], label: string): PreloadItem {
  const total = sources.reduce((a, s) => a + s.bytes, 0);
  return {
    id,
    label,
    weight: Math.max(1, Math.round(total / 400_000)),
    memo: false,
    run: async (report) => {
      const got = new Array<number>(sources.length).fill(0);
      await Promise.all(
        sources.map((src, i) =>
          bitmapItem(src, label).run(
            (fraction) => {
              got[i] = fraction * src.bytes;
              report(Math.min(0.95, got.reduce((a, b) => a + b, 0) / Math.max(1, total)));
            },
            { background: false },
          ),
        ),
      );
    },
  };
}

/**
 * What the field needs: its code, the portrait pictures of the cards (the hero shows them at
 * once) and the wide pictures of the wall. Real bytes, no timer. A section puts this list in its
 * own `preload()`. This file imports no three.js (it is in the bundle of every page).
 */
export function fieldItems(
  set: FieldSetName = "hero",
  options: FieldItemOptions = {},
): PreloadItem[] {
  const def = setDef(set);
  const deferred = options.wide === "deferred";
  return [
    chunkItem("home-field", "Hanging the art", () => import("./actor"), 1),
    ...def.portraits.map((pic) => bitmapItem(portraitSource(pic), "Loading the hero art")),
    ...def.walls.map((pic) =>
      bitmapItem(wideSource(pic), "Loading the wall", {
        deferred,
        priority: options.priority ?? 20,
      }),
    ),
    // The wall's extra thumbnails are small and the wall fills with them as it lands: always waited.
    ...(def.tiles.length > 0
      ? [bundleItem("field:tiles", def.tiles.map(wideSource), "Loading the wall")]
      : []),
  ];
}
