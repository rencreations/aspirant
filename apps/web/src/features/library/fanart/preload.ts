import { imageItem, chunkItem, type PreloadItem } from "@/lib/preload";
import { libUrl } from "@/lib/library";

import { fetchLibraryJson, libraryDataItem, libraryDataPath } from "../data";
import type { CollectionFile } from "../types";
import type { FanItem } from "./types";

/** Thumbnails the wall draws first (the newest pictures), then the posters of the first videos. */
const FIRST_PICTURES = 10;
const FIRST_POSTERS = 3;

function firstScreen(): PreloadItem {
  return {
    id: "library-fanart-first-screen",
    label: "Loading the first fan art",
    weight: 3,
    run: async (report, context) => {
      const file = await fetchLibraryJson<CollectionFile<FanItem>>(libraryDataPath("fanart"));
      const byNew = [...file.items].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
      const keys = [
        ...byNew
          .filter((i) => i.kind !== "video")
          .slice(0, FIRST_PICTURES)
          .map((i) => i.img.t),
        ...byNew
          .filter((i) => i.kind === "video" && i.video)
          .slice(0, FIRST_POSTERS)
          .map((i) => i.video?.poster ?? i.img.p),
      ];
      let done = 0;
      await Promise.all(
        keys.map(async (key) => {
          await imageItem(libUrl(key), "Loading the first fan art").run(() => undefined, context);
          done += 1;
          report(done / keys.length);
        }),
      );
    },
  };
}

/** What the fanart room needs on first paint. Only the first screen is waited for. */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("fanart"),
    chunkItem("library-fanart", "Opening the fanart room", () => import("./page"), 2),
    firstScreen(),
  ];
}
