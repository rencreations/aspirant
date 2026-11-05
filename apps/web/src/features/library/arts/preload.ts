import { imageItem, chunkItem, type PreloadItem } from "@/lib/preload";
import { libUrl } from "@/lib/library";

import { fetchLibraryJson, libraryDataItem, libraryDataPath } from "../data";
import type { CollectionFile } from "../types";
import { firstScreenKeys, restKeys } from "./filter";
import { SCENES_DATA, type ArtItem } from "./types";

/** Fetch a list of library pictures into the browser cache, reporting how many have arrived. */
function pictures(
  id: string,
  label: string,
  pick: (items: readonly ArtItem[]) => string[],
  options: { weight: number; deferred?: boolean; priority?: number },
): PreloadItem {
  return {
    id,
    label,
    weight: options.weight,
    deferred: options.deferred,
    priority: options.priority,
    run: async (report, context) => {
      const file = await fetchLibraryJson<CollectionFile<ArtItem>>(libraryDataPath("arts"));
      const keys = pick(file.items);
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

/** The scene stills data, read once into the shared cache. A missing file is not an error here. */
function scenesData(): PreloadItem {
  return {
    id: "library-arts-scenes-data",
    label: "Reading the scene stills",
    weight: 1,
    deferred: true,
    priority: 40,
    run: async () => {
      try {
        await fetchLibraryJson(SCENES_DATA);
      } catch {
        // The stills may not be built yet: the tab is then simply without a count.
      }
    },
  };
}

/**
 * What the arts room needs on first paint: its data file, its code, and the pictures of the first
 * screen (the ten splash previews of the ribbon and the first two thumbnails of the grid, twelve
 * in all). The rest of the thumbnails, the scene stills tab and its data are deferred: the bar
 * does not wait for them.
 */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("arts"),
    chunkItem("library-arts", "Opening the arts room", () => import("./page"), 2),
    pictures("library-arts-first", "Loading the splash art", (all) => firstScreenKeys(all), {
      weight: 6,
    }),
    pictures("library-arts-rest", "Loading the rest of the art", (all) => restKeys(all), {
      weight: 1,
      deferred: true,
      priority: 30,
    }),
    {
      ...chunkItem(
        "library-arts-scenes",
        "Opening the scene stills",
        () => import("./scenes/scenes-tab"),
        1,
      ),
      deferred: true,
      priority: 35,
    },
    scenesData(),
  ];
}
