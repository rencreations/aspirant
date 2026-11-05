import { chunkItem, type PreloadItem } from "@/lib/preload";

import { libraryDataItem } from "../data";

/** What the animation room needs on first paint. Only the first screen is waited for: mark the rest `deferred`. */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("animation"),
    chunkItem("library-animation", "Opening the animation room", () => import("./page"), 2),
  ];
}
