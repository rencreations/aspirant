import { chunkItem, type PreloadItem } from "@/lib/preload";

import { libraryDataItem } from "../data";

/** What the music room needs on first paint. Only the first screen is waited for: mark the rest `deferred`. */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("music"),
    chunkItem("library-music", "Opening the music room", () => import("./page"), 2),
  ];
}
