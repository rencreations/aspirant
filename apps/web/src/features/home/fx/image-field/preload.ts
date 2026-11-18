import { chunkItem, type PreloadItem } from "@/lib/preload";

import { bitmapItem } from "./bitmaps";
import { portraitSource, setDef, wideSource, type FieldSetName } from "./sets";

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
  ];
}
