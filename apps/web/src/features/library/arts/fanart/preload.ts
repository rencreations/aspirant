import { libUrl } from "@/lib/library";
import { chunkItem, imageItem, type PreloadItem } from "@/lib/preload";

import { fetchLibraryJson, libraryDataItem, libraryDataPath } from "../../data";
import type { CollectionFile } from "../../types";
import { firstKeys } from "./first-keys";
import { adaptFan, movedTarget } from "./model";
import type { FanRaw } from "./types";

const LABEL = "Loading the first fan art";

function firstScreen(): PreloadItem {
  return {
    id: "library-arts-fanart-first",
    label: LABEL,
    weight: 4,
    run: async (report, context) => {
      // An old address of a cosplay photo is sent on by the page: nothing here is needed.
      if (movedTarget(new URLSearchParams(window.location.search).get("i") ?? "")) return;
      const file = await fetchLibraryJson<CollectionFile<FanRaw>>(libraryDataPath("arts-fanart"));
      const keys = firstKeys(file.items.map(adaptFan), window.location.search, {
        width: document.documentElement.clientWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio,
      });
      let done = 0;
      await Promise.all(
        keys.map(async (key) => {
          await imageItem(libUrl(key), LABEL).run(() => undefined, context);
          done += 1;
          report(done / Math.max(1, keys.length));
        }),
      );
    },
  };
}

/** What the Fanart room needs on first paint. Only the first screen is waited for. */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("arts-fanart"),
    chunkItem("library-arts-fanart", "Opening the room", () => import("./page"), 2),
    firstScreen(),
  ];
}
