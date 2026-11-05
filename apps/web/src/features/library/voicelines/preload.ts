import { chunkItem, type PreloadItem } from "@/lib/preload";

import { libraryDataItem } from "../data";

/** What the voicelines room needs on first paint. Only the first screen is waited for: mark the rest `deferred`. */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("voicelines"),
    chunkItem("library-voicelines", "Opening the voicelines room", () => import("./page"), 2),
  ];
}
