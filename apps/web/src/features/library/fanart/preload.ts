import { chunkItem, type PreloadItem } from "@/lib/preload";

import { libraryDataItem } from "../data";

/** What the fanart room needs on first paint. Only the first screen is waited for: mark the rest `deferred`. */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("fanart"),
    chunkItem("library-fanart", "Opening the fanart room", () => import("./page"), 2),
  ];
}
