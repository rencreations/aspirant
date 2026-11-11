import { libUrl } from "@/lib/library";
import { chunkItem, imageItem, type PreloadItem } from "@/lib/preload";

import { libraryDataItem } from "../../data";
import { fetchArtsData } from "../core/data";
import { buildIndex, filterIndexes, searchIndexes } from "../core/flow/filter";
import { comicFacetOf, comicFacets, comicSearchOf } from "./facets";
import { firstScreenIndexes, metricsFor, pickSize, planComic } from "./layout";
import type { ComicHead, ComicItem } from "./types";

/** The widest the box of panels gets (`.box` in `comic.module.css`). */
const BOX_MAX = 1480;
/** What stands above the panels on the first screen: the bar, the title and the filter. A wide screen, then a phone. */
const HEAD_WIDE = 340;
const HEAD_NARROW = 330;
/** At most this many panels are waited for. */
const FIRST_PANELS = 6;

/** The page's side gutter in pixels (`--gutter` is a clamp, so it is read from a probe). */
function gutterPx(): number {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;left:0;top:0;width:var(--gutter);height:0;visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const w = probe.offsetWidth;
  probe.remove();
  return w;
}

/**
 * The first screen of the room: the thumbnail and the sharp picture of the panels that show when
 * the page opens (the screen, the search and the filter in the address decide which, with the
 * lanes planned by the page's own maths), and the preview of the panel the address opens (`i`).
 * Every other picture loads when its tile comes near.
 */
function firstPanels(): PreloadItem {
  const label = "Loading the first panels";
  return {
    id: "library-arts-comic-first",
    label,
    weight: 4,
    run: async (report, context) => {
      const file = await fetchArtsData<ComicItem, ComicHead>("comic");
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q") ?? "";
      const f = params.get("f") ?? "";
      const open = params.get("i") ?? "";

      const facets = comicFacets(file);
      const index = buildIndex(file.items, comicFacetOf, comicSearchOf, facets);
      const known = facets.some((facet) => facet.id === f);
      const shown = filterIndexes(index, searchIndexes(index, q), known ? f : "")
        .map((i) => file.items[i])
        .filter((item): item is ComicItem => item !== undefined);

      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const box = Math.min(BOX_MAX, Math.max(1, vw - 2 * gutterPx()));
      const plan = planComic(
        shown.map((item) => ({ w: item.img.w, h: item.img.h })),
        metricsFor(box, vh),
        shown.map((item) => item.comic),
      );

      const keys = new Set<string>();
      for (const at of firstScreenIndexes(
        plan,
        vw >= 640 ? HEAD_WIDE : HEAD_NARROW,
        vh,
        FIRST_PANELS,
      )) {
        const item = shown[at];
        const tile = plan.tiles[at];
        if (!item || !tile) continue;
        keys.add(item.img.t);
        keys.add(item.img[pickSize(tile.pan || tile.w, window.devicePixelRatio, item.img.w)]);
      }
      const linked = open ? file.items.find((item) => item.id === open) : undefined;
      if (linked) keys.add(linked.img.p);

      let done = 0;
      const total = Math.max(1, keys.size);
      await Promise.all(
        [...keys].map(async (key) => {
          await imageItem(libUrl(key), label).run(() => undefined, context);
          done += 1;
          report(done / total);
        }),
      );
    },
  };
}

/** What the first screen of Comic needs: the data file, the room's code and the first panels. */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("arts-comic"),
    chunkItem("library-arts-comic", "Opening the room", () => import("./page"), 2),
    firstPanels(),
  ];
}
