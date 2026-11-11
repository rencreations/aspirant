import { libUrl } from "@/lib/library";
import { imageItem, type PreloadItem } from "@/lib/preload";

import { fetchArtsData } from "../data";
import type { ArtsRoom } from "../routes";
import type { ArtsFile, ArtsItem, Facet } from "../types";
import { buildIndex, filterIndexes, searchIndexes } from "./filter";
import { firstScreenIndexes, pickSize, tileRatio } from "./math";
import { currentMetrics } from "./viewport";

/**
 * The loading list's item for a flow room: the thumbnails of the pictures that show on the first
 * screen (the first rows, as the screen's size and the address's `q` and `f` make them), and the
 * preview of the picture the address opens (`i`). It builds the rows with the page's own maths and
 * asks for the size the tiles ask for, so what the bar waits for is what the page draws. Everything
 * else in the room loads when the rows reach it.
 *
 * Import this file from a room's `preload.ts`, not `index.ts`: it holds no component.
 */

/** About this many pictures are waited for. */
const FIRST_PICTURES = 14;
/** What stands above the rows on the first screen (the top bar, the head and the chips). */
const HEAD_OFFSET = 300;

export interface FlowFirstScreenOptions<T extends ArtsItem, Head = { facets?: Facet[] }> {
  /** The item's id in the loading list, unique per room. */
  id: string;
  room: ArtsRoom;
  label: string;
  facetOf: (item: T) => readonly string[];
  searchOf: (item: T) => string;
  /** The filter of the room, from its data file: the same function the page uses. Default: the file's `facets`. */
  facets?: (file: ArtsFile<T> & Head) => readonly Facet[];
  /** The weight of the item in the loading bar. Default 4. */
  weight?: number;
}

export function flowFirstScreen<T extends ArtsItem, Head = { facets?: Facet[] }>(
  options: FlowFirstScreenOptions<T, Head>,
): PreloadItem {
  return {
    id: options.id,
    label: options.label,
    weight: options.weight ?? 4,
    run: async (report, context) => {
      const file = await fetchArtsData<T, Head>(options.room);
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q") ?? "";
      const f = params.get("f") ?? "";
      const open = params.get("i") ?? "";

      const facets = options.facets
        ? options.facets(file)
        : ((file as { facets?: Facet[] }).facets ?? []);
      const index = buildIndex(file.items, options.facetOf, options.searchOf, facets);
      const searched = searchIndexes(index, q);
      const known = facets.length === 0 || facets.some((facet) => facet.id === f);
      const shown = filterIndexes(index, searched, known ? f : "")
        .map((i) => file.items[i])
        .filter((item): item is T => item !== undefined);

      const m = currentMetrics();
      const ratios = shown.map((item) => tileRatio(item.img.w, item.img.h));
      const keys: string[] = [];
      for (const at of firstScreenIndexes(ratios, m, HEAD_OFFSET, FIRST_PICTURES)) {
        const item = shown[at];
        if (!item) continue;
        const w = Math.round((ratios[at] ?? 1) * m.rowH);
        keys.push(item.img[pickSize(w, m.rowH, window.devicePixelRatio)]);
      }
      const linked = open ? file.items.find((item) => item.id === open) : undefined;
      if (linked) keys.push(linked.img.p);

      let done = 0;
      await Promise.all(
        keys.map(async (key) => {
          await imageItem(libUrl(key), options.label).run(() => undefined, context);
          done += 1;
          report(done / Math.max(1, keys.length));
        }),
      );
    },
  };
}
