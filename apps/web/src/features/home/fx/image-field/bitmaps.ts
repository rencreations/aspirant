/**
 * The decoded pictures of the field, kept in a store the loading list fills and the actor reads.
 * It is not `imageItem`: that decodes through an `Image` with no CORS, which the browser keeps in
 * its cache, so the same address later asked for with CORS (WebGL needs it for the library's
 * pictures) can be refused. Here the file is fetched whole (the bar counts the bytes, a stall or a
 * drop is tried again) and decoded with `createImageBitmap`, cropped to its window, off the main
 * thread. No three.js in this file: the preload list imports it, and that is in every page's bundle.
 */
import type { PreloadItem } from "@/lib/preload";
import { fetchWhole } from "@/lib/media-store";
import { PermanentFailure, untilItArrives } from "@/lib/retry";

import type { PicSource } from "./sets";

const store = new Map<string, ImageBitmap>();
/** A download in flight, shared by the loading list and the field, so a picture is never fetched twice. */
const inflight = new Map<string, Promise<ImageBitmap>>();
const listeners = new Set<(id: string) => void>();

/** Fetch whole and decode one picture. Reports the bytes received. Throws `PermanentFailure` when it cannot be decoded. */
async function decode(
  src: PicSource,
  report?: (fraction: number, bytes?: { received: number; total: number }) => void,
): Promise<ImageBitmap> {
  return untilItArrives(async () => {
    const { blob } = await fetchWhole(src.url, {
      onBytes: (received, total) => {
        report?.(Math.min(0.95, received / total), { received, total });
      },
    });
    try {
      const c = src.crop;
      return c
        ? await createImageBitmap(blob, c.sx, c.sy, c.sw, c.sh, { premultiplyAlpha: "none" })
        : await createImageBitmap(blob, { premultiplyAlpha: "none" });
    } catch (error) {
      throw new PermanentFailure(`Cannot decode ${src.url}: ${String(error)}`);
    }
  });
}

/** The picture from the store, or from the download already running, or from a new one. */
function load(
  src: PicSource,
  report?: (fraction: number, bytes?: { received: number; total: number }) => void,
): Promise<ImageBitmap> {
  const have = store.get(src.id);
  if (have) return Promise.resolve(have);
  let running = inflight.get(src.id);
  if (!running) {
    running = decode(src, report)
      .then((bitmap) => {
        const late = store.get(src.id);
        if (late) {
          bitmap.close();
          return late;
        }
        store.set(src.id, bitmap);
        listeners.forEach((fn) => {
          fn(src.id);
        });
        return bitmap;
      })
      .finally(() => {
        inflight.delete(src.id);
      });
    inflight.set(src.id, running);
  }
  return running;
}

/** A loading list item for one picture of a field. Its bitmap is kept in the store. */
export function bitmapItem(
  src: PicSource,
  label: string,
  options: { deferred?: boolean; priority?: number } = {},
): PreloadItem {
  return {
    id: src.id,
    label,
    weight: Math.max(1, Math.round(src.bytes / 400_000)),
    // Freed when the field goes, so the next visit asks again (from the browser's cache).
    memo: false,
    deferred: options.deferred,
    priority: options.priority,
    run: async (report) => {
      // A bitmap that is already here (or on its way) is not fetched or closed again.
      await load(src, report);
    },
  };
}

/** The bitmap of a picture, from the loading list, or fetched now when the list did not run. Null when it is gone. */
export async function getBitmap(src: PicSource): Promise<ImageBitmap | null> {
  try {
    return await load(src);
  } catch {
    return null;
  }
}

/** The bitmap in the store, if it is there (no download). */
export function peekBitmap(id: string): ImageBitmap | null {
  return store.get(id) ?? null;
}

/** Tell `fn` the id of every picture that arrives in the store. Returns the way to stop. */
export function onBitmap(fn: (id: string) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * The GPU has `bitmap` now (or the field is gone): close it, and take its entry out of the store
 * only if the store still holds that very bitmap (a newer one under the same id is not touched).
 */
export function releaseBitmap(id: string, bitmap?: ImageBitmap): void {
  const held = store.get(id);
  if (bitmap) bitmap.close();
  if (!bitmap || held === bitmap) {
    held?.close();
    store.delete(id);
  }
}
