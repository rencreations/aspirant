import { libUrl } from "@/lib/library";
import { chunkItem, imageItem, type PreloadItem } from "@/lib/preload";

import { fetchLibraryJson, libraryDataItem, libraryDataPath } from "../data";
import { firstScreenKeys, restKeys } from "./film-data";
import type { FilmsFile } from "./types";

/** Fetch library pictures into the browser cache, reporting how many have arrived. */
function pictures(
  id: string,
  label: string,
  pick: (file: FilmsFile) => string[],
  options: { weight: number; deferred?: boolean; priority?: number },
): PreloadItem {
  return {
    id,
    label,
    weight: options.weight,
    deferred: options.deferred,
    priority: options.priority,
    run: async (report, context) => {
      const file = await fetchLibraryJson<FilmsFile>(libraryDataPath("films"));
      const keys = pick(file);
      let done = 0;
      await Promise.all(
        keys.map(async (key) => {
          await imageItem(libUrl(key), label).run(() => undefined, context);
          done += 1;
          report(done / keys.length);
        }),
      );
    },
  };
}

/**
 * What the films room needs on first paint: its data file, its code, the poster of the featured
 * film and the first row of thumbnails. The other thumbnails are deferred. The films themselves
 * are never loaded ahead: they stream when the visitor presses play.
 */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("films"),
    chunkItem("library-films", "Opening the films room", () => import("./page"), 2),
    pictures(
      "library-films-first",
      "Loading the featured film",
      (file) => firstScreenKeys(file.items, file.featured),
      { weight: 4 },
    ),
    pictures(
      "library-films-rest",
      "Loading the rest of the posters",
      (file) => restKeys(file.items, file.featured),
      { weight: 1, deferred: true, priority: 30 },
    ),
  ];
}
