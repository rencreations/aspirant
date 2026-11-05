import { chunkItem, type PreloadItem } from "@/lib/preload";

import { libraryDataItem } from "../data";

/** What the design room needs on first paint. Only the first screen is waited for: mark the rest `deferred`. */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("design"),
    chunkItem("library-design", "Opening the design room", () => import("./page"), 2),
  ];
}
