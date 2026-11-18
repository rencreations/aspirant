import { chunkItem, imageItem, type PreloadItem } from "@/lib/preload";
import { THEMLABEL_LOGO } from "@/features/about/media";

import { fullItems } from "../../preview/files";

/**
 * What the aspirants section needs, as loading items (see `kernel/preload.ts`). The first thing a
 * visitor does is scroll, so the section's scene code and the two small logos of its words are
 * waited for. The wall's pictures are the hero's list (`fieldItems`, waited). The full size
 * pictures of the preview window (9 MB for the eighteen) are the one thing the page does not show
 * until it is asked: they load behind everything else, and a press that comes first fetches its own
 * (`preview/files.ts`).
 */
export function preload(): PreloadItem[] {
  return [
    chunkItem("home-aspirants", "Hanging the wall", () => import("./runtime"), 1),
    imageItem("/img/home/mlbb.webp", "Loading the logos", 1),
    imageItem(THEMLABEL_LOGO, "Loading the logos", 1),
    ...fullItems(),
  ];
}
