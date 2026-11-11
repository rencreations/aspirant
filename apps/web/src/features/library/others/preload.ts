import { chunkItem, type PreloadItem } from "@/lib/preload";

import { libraryDataItem } from "../data";

/**
 * What the others room needs on first paint: its data and its code. Its pictures and clips are
 * further down the page and load lazily. (The 3D models have their own room, `models/`.)
 */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("others"),
    chunkItem("library-others", "Opening the others room", () => import("./page"), 2),
  ];
}
