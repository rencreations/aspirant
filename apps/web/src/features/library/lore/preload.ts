import { libUrl } from "@/lib/library";
import { chunkItem, imageItem, type PreloadItem } from "@/lib/preload";
import { CHARACTER_SLUGS } from "@/lib/slugs";

import { libraryDataItem } from "../data";
import { ATLAS_THUMBS } from "./atlas-thumbs.generated";

/**
 * What the lore room needs on first paint: its data file (all 28 texts) and its code. The room
 * opens on the list of texts, which has no pictures. The 24 atlas thumbnails and the ten portraits
 * of the Who is who view are only wanted when the visitor opens those views, so they download in
 * the background, after everything else.
 */
export function items(): PreloadItem[] {
  const thumbs: PreloadItem[] = ATLAS_THUMBS.map((key, i) => ({
    ...imageItem(libUrl(key), "Warming the atlas", 0.2),
    deferred: true,
    priority: 60 + i,
    group: "lore",
  }));
  const faces: PreloadItem[] = CHARACTER_SLUGS.map((slug, i) => ({
    ...imageItem(`/img/char/${slug}/splash-sm.webp`, "Warming the portraits", 0.2),
    deferred: true,
    priority: 90 + i,
    group: "lore",
  }));
  return [
    libraryDataItem("lore"),
    chunkItem("library-lore", "Opening the lore room", () => import("./page"), 2),
    ...thumbs,
    ...faces,
  ];
}
