/**
 * The loading list of the wall's picture pool (`pool.ts`). This file imports no three.js (it is in the bundle of every
 * page) and none of the pool's data: the list is made of a fixed number of items that read `wall.json` when they run.
 *
 * - `field:pool:first` is WAITED: the first `pool.first` pictures of the cyclic order (24, about 0.65 MB). They are the
 *   pictures the wall shows at its first rest, so they are decoded into the field's bitmap store (the bar counts their
 *   real bytes, like `fieldItems`).
 * - `field:pool:1` to `field:pool:8` are DEFERRED, 20 pictures each, in the order of the cycle (about 0.55 MB each).
 *   The bar does not wait for them. They only fetch the bytes into the browser's cache (no decode: 135 decoded bitmaps
 *   would hold about 125 MB): the wall decodes a picture with `getBitmap(poolSource(pic))` when it needs it, and that
 *   comes from the cache, or shares the download that is still running.
 *
 * The wall asks `loadPool()` for the data (the same single fetch). A tranche past the end of a smaller pool does nothing.
 */
import type { PreloadItem } from "@/lib/preload";
import { fetchWhole } from "@/lib/media-store";
import { untilItArrives } from "@/lib/retry";

import { bitmapItem } from "./bitmaps";
import { firstScreen, loadPool, ordered, poolSource, type PoolPicture } from "./pool";

/** Pictures in a deferred item. */
const POOL_TRANCHE = 20;
/** Deferred items. Eight of twenty cover the 135 pictures after the first 24 with room to grow. */
const POOL_TRANCHES = 8;
/** The deferred items start in this order, after the other deferred pictures of the wall (the smaller, the sooner). */
const POOL_PRIORITY = 40;

const LABEL = "Loading the wall";

/** The first pictures, decoded. Waited. */
function firstItem(): PreloadItem {
  return {
    id: "field:pool:first",
    label: LABEL,
    weight: 2,
    memo: false,
    run: async (report, context) => {
      const pics = firstScreen(await loadPool());
      const total = Math.max(
        1,
        pics.reduce((a, p) => a + p.bytes, 0),
      );
      const got = new Array<number>(pics.length).fill(0);
      await Promise.all(
        pics.map((pic, i) =>
          bitmapItem(poolSource(pic), LABEL).run((fraction) => {
            got[i] = fraction * pic.bytes;
            report(Math.min(0.95, got.reduce((a, b) => a + b, 0) / total));
          }, context),
        ),
      );
    },
  };
}

/** Warm the browser's cache with one file. A missing file (404 or 410) ends the item and is logged by the list. */
function warm(pic: PoolPicture): Promise<unknown> {
  return untilItArrives(() => fetchWhole(poolSource(pic).url));
}

/** One deferred tranche: the pictures `[first + t * 20, first + (t + 1) * 20)` of the cycle, fetched into the cache. */
function trancheItem(t: number): PreloadItem {
  return {
    id: `field:pool:${t + 1}`,
    label: LABEL,
    weight: 1,
    memo: false,
    deferred: true,
    priority: POOL_PRIORITY + t,
    run: async (report) => {
      const pool = await loadPool();
      const from = pool.first + t * POOL_TRANCHE;
      const pics = ordered(pool).slice(from, from + POOL_TRANCHE);
      let done = 0;
      await Promise.all(
        pics.map(async (pic) => {
          await warm(pic);
          done += 1;
          report(Math.min(0.95, done / pics.length));
        }),
      );
    },
  };
}

/**
 * What the pool needs: the first screen's pictures (waited) and the rest (deferred, in cycle order). A section puts
 * this in its `preload()` next to `fieldItems`.
 */
export function poolItems(): PreloadItem[] {
  return [firstItem(), ...Array.from({ length: POOL_TRANCHES }, (_, t) => trancheItem(t))];
}
