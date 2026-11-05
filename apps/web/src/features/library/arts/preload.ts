import { chunkItem, type PreloadItem } from "@/lib/preload";

import { libraryDataItem } from "../data";

/** What the arts room needs on first paint. Only the first screen is waited for: mark the rest `deferred`. */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("arts"),
    chunkItem("library-arts", "Opening the arts room", () => import("./page"), 2),
  ];
}
