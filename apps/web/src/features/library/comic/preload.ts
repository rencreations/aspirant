import { imageItem, chunkItem, type PreloadItem } from "@/lib/preload";
import { libUrl } from "@/lib/library";

import { libraryDataItem } from "../data";

/**
 * What the comic room needs on first paint: its data, its code and the two official covers (their
 * keys are fixed by `scripts/library/comic/build.py`). The fan covers, the first-page strips and
 * every page of the reader load lazily as they come on screen.
 */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("comic"),
    chunkItem("library-comic", "Opening the comic room", () => import("./page"), 2),
    imageItem(libUrl("comic/the-aspirant/cover/p.webp"), "Loading the first cover", 1),
    imageItem(libUrl("comic/guinevere-vexana/cover/p.webp"), "Loading the second cover", 1),
  ];
}
