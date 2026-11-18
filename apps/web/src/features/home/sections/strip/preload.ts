import { chunkItem, type PreloadItem } from "@/lib/preload";

import { filmItems } from "../../fx/video-plane/preload";

/**
 * What the strip needs, as loading items (see `kernel/preload.ts`). The film's chunk and the trailer
 * loop are the rows' list (waited for: the strip is the next thing the visitor reaches). The strip's
 * own scene code is waited for too. The ten preview clips are the film's list, `deferred`, in order
 * of the scroll: the pull that shows them is screens away. The whole trailer that the play button
 * opens is streamed by the site's player when it is pressed: it is never loaded here.
 */
export function preload(): PreloadItem[] {
  return [
    chunkItem("home-strip", "Hanging the strip", () => import("./runtime"), 1),
    ...filmItems(),
  ];
}
