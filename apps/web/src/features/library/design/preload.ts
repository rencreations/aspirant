import { imageItem, chunkItem, type PreloadItem } from "@/lib/preload";

import { fetchLibraryJson, libraryDataItem, libraryDataPath } from "../data";
import { libUrl } from "@/lib/library";
import { coverOf, pickSize } from "./model";
import type { DesignFile } from "./types";

/** How many posters the first screen shows: the loading bar waits for these. */
const FIRST_SCREEN = 8;

/**
 * The first posters of the wall (the oldest campaign, the default order). It reads the data file
 * (already in the cache from the item before it) and loads the pictures, so the wall opens full.
 */
function firstScreenItem(): PreloadItem {
  return {
    id: "library-design-first",
    label: "Loading the first posters",
    weight: 3,
    run: async (report, context) => {
      const file = await fetchLibraryJson<DesignFile>(libraryDataPath("design"));
      const first = [...file.campaigns].sort((a, b) => a.from.localeCompare(b.from))[0];
      const byId = new Map(file.items.map((p) => [p.id, p]));
      const keys = (first?.posts ?? [])
        .slice(0, FIRST_SCREEN)
        .map((id) => byId.get(id))
        .filter((p) => p !== undefined)
        .map((p) => coverOf(p)[pickSize(300, 300, window.devicePixelRatio || 1)]);
      let done = 0;
      await Promise.all(
        keys.map((key) =>
          imageItem(libUrl(key), "Loading a poster")
            .run(() => undefined, context)
            .then(() => {
              done += 1;
              report(done / keys.length);
            }),
        ),
      );
    },
  };
}

/** What the design room needs on first paint. Only the first screen is waited for. */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("design"),
    chunkItem("library-design", "Opening the design room", () => import("./page"), 2),
    firstScreenItem(),
  ];
}
