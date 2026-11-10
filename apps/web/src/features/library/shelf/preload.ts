import { libUrl } from "@/lib/library";
import { chunkItem, imageItem, type PreloadItem } from "@/lib/preload";

import { COLLECTIONS } from "../registry";
import { coverBitmapItem } from "./cover-art";
import { VIDEO_HALVES } from "./video-halves";

/**
 * What the shelf needs on first paint: the code of the scene (three.js and the engine, one lazy
 * chunk, the same one the page imports), the ten covers and the two inside pictures of the Video
 * cover (it opens into them, and `/collection?open=video` opens on them), fetched whole and decoded
 * so the scene never asks for them again. The type is in the shared list (`fontsItem`). The library
 * index (`/data/library/index.json`, only the counts under the names) is read by the scene when it
 * arrives and is not waited for.
 */
export function shelfItems(): PreloadItem[] {
  return [
    chunkItem("library-shelf", "Loading the shelf", () => import("./shelf-scene"), 3),
    ...COLLECTIONS.map((c) => coverBitmapItem(c.cover, `Loading the ${c.name} cover`, 2)),
    ...VIDEO_HALVES.map((h) => coverBitmapItem(h.cover, `Loading the ${h.name} cover`, 2)),
  ];
}

/**
 * The loading list of `/collection/video` (the plain page with the two ways in): its two
 * pictures, the inside of the Video cover.
 */
export function videoChooserItems(): PreloadItem[] {
  return VIDEO_HALVES.map((h) => imageItem(libUrl(h.cover), `Loading ${h.name}`, 2));
}
