import { chunkItem, type PreloadItem } from "@/lib/preload";

import { COLLECTIONS } from "../registry";
import { coverBitmapItem } from "./cover-art";

/**
 * What the shelf needs on first paint: the code of the scene (three.js and the engine, one lazy
 * chunk, the same one the page imports) and the ten covers, fetched whole and decoded so the
 * scene never asks for them again. The type is in the shared list (`fontsItem`). The library index
 * (`/data/library/index.json`, only the counts under the names) is read by the scene when it
 * arrives and is not waited for.
 */
export function shelfItems(): PreloadItem[] {
  return [
    chunkItem("library-shelf", "Loading the shelf", () => import("./shelf-scene"), 3),
    ...COLLECTIONS.map((c) => coverBitmapItem(c.cover, `Loading the ${c.name} cover`, 2)),
  ];
}
