import { chunkItem, type PreloadItem } from "@/lib/preload";

import { libraryDataItem } from "../data";

/** What the films room needs on first paint. Only the first screen is waited for: mark the rest `deferred`. */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("films"),
    chunkItem("library-films", "Opening the films room", () => import("./page"), 2),
  ];
}
