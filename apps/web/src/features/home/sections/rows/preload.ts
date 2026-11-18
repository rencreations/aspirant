import { chunkItem, type PreloadItem } from "@/lib/preload";

import { filmItems } from "../../fx/video-plane/preload";

/**
 * What the rows need, as loading items (see `kernel/preload.ts`). The film appears a little after the
 * wall, so its scene code and the trailer loop (2.4 or 3.8 MB, by the display's size) are waited for:
 * the visitor's first act is to scroll, and the rows must open with the picture moving. The ten
 * preview clips of the strip (2.7 MB) are the film's own list, `deferred`: the hold is screens away.
 */
export function preload(): PreloadItem[] {
  return [chunkItem("home-rows", "Laying the rows", () => import("./runtime"), 1), ...filmItems()];
}
