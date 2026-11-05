import { libUrl } from "@/lib/library";
import { chunkItem, imageItem, type PreloadItem } from "@/lib/preload";

import { libraryDataItem } from "../data";

/**
 * What the music room needs on first paint: its data, its code and the covers of the first shelf
 * (five records, in the order of `music.json`). The songs are fetched when a record is played.
 */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("music"),
    chunkItem("library-music", "Opening the music room", () => import("./page"), 2),
    imageItem("/img/pair/fanny-layla/fanny-and-layla.webp", "Loading the covers"),
    imageItem("/img/char/lesley/splash-sm.webp", "Loading the covers"),
    imageItem("/img/char/vexana/splash-sm.webp", "Loading the covers"),
    imageItem("/img/char/guinevere/splash-sm.webp", "Loading the covers"),
    imageItem(libUrl("music/covers/gray-new-world/t.webp"), "Loading the covers"),
  ];
}
