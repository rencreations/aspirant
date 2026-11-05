import { chunkItem, imageItem, type PreloadItem } from "@/lib/preload";

import { libraryDataItem } from "../data";

/**
 * What the voicelines room needs on first paint: its data, its code and the first splash
 * picture. The sound files are fetched when a line is played (a few kilobytes each).
 */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("voicelines"),
    chunkItem("library-voicelines", "Opening the voicelines room", () => import("./page"), 2),
    imageItem("/img/char/fanny/splash-sm.webp", "Loading the portraits"),
  ];
}
