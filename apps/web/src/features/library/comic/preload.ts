import { libUrl } from "@/lib/library";
import { imageItem, chunkItem, type PreloadItem } from "@/lib/preload";

import { fetchLibraryJson, libraryDataItem, libraryDataPath } from "../data";
import type { ComicFile } from "./types";

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

/** The first pages of one comic: the reader opens on them, so the curtain waits for the first two. */
function firstPagesItem(slug: string): PreloadItem {
  return {
    id: `library-comic-first:${slug}`,
    label: "Loading the first pages",
    weight: 3,
    run: async (report, context) => {
      const file = await fetchLibraryJson<ComicFile>(libraryDataPath("comic"));
      const comic = file.items.find((c) => c.slug === slug);
      const keys = (comic?.pages ?? []).slice(0, 2).map((p) => p.s?.[0]?.p ?? p.p);
      let done = 0;
      await Promise.all(
        keys.map((key) =>
          imageItem(libUrl(key), "Loading a page")
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

/** What a comic's own page needs: its data, the code of the reader and its first pages. */
export function readerItems(slug: string): PreloadItem[] {
  return [
    libraryDataItem("comic"),
    chunkItem("library-comic-reader", "Opening the reader", () => import("./reader-page"), 2),
    firstPagesItem(slug),
  ];
}
