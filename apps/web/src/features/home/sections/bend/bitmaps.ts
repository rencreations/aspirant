/**
 * The decoded pictures of the bend section, kept in a store that the loading list fills and the
 * cards read. A picture is fetched whole (the bar counts the bytes, a stall or a drop is tried
 * again, see `lib/media-store.ts`) and decoded with `createImageBitmap` at the size the GPU budget
 * allows, off the main thread. It is not `imageItem`: that decodes through an `Image` with no CORS,
 * which the browser keeps in its cache, so the same library address asked for later with CORS (WebGL
 * needs it) can be refused. No three.js here: `preload.ts` imports this file, and that file is in
 * the bundle of every page.
 */
import type { PreloadItem } from "@/lib/preload";
import { fetchWhole } from "@/lib/media-store";
import { PermanentFailure, untilItArrives } from "@/lib/retry";

import { decodedSize, type PicSource } from "./pictures";

type Report = (fraction: number, bytes?: { received: number; total: number }) => void;

const store = new Map<string, ImageBitmap>();
/** A download in flight, shared by the loading list and the cards, so a picture is never fetched twice. */
const inflight = new Map<string, Promise<ImageBitmap>>();

async function decode(src: PicSource, report?: Report): Promise<ImageBitmap> {
  return untilItArrives(async () => {
    const { blob } = await fetchWhole(src.url, {
      onBytes: (received, total) => {
        report?.(Math.min(0.95, received / total), { received, total });
      },
    });
    try {
      const size = decodedSize(src);
      const options: ImageBitmapOptions = {
        resizeWidth: size.w,
        resizeHeight: size.h,
        resizeQuality: "high",
        premultiplyAlpha: src.premultiply ? "premultiply" : "none",
      };
      const c = src.crop;
      return c
        ? await createImageBitmap(blob, c.sx, c.sy, c.sw, c.sh, options)
        : await createImageBitmap(blob, options);
    } catch (error) {
      throw new PermanentFailure(`Cannot decode ${src.url}: ${String(error)}`);
    }
  });
}

function load(src: PicSource, report?: Report): Promise<ImageBitmap> {
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
        return bitmap;
      })
      .finally(() => {
        inflight.delete(src.id);
      });
    inflight.set(src.id, running);
  }
  return running;
}

/** A loading list item for one picture. Its bitmap is kept in the store until a card has it on the GPU. */
export function bitmapItem(
  src: PicSource,
  label: string,
  options: { deferred?: boolean; priority?: number } = {},
): PreloadItem {
  return {
    id: src.id,
    label,
    weight: Math.max(1, Math.round(src.bytes / 400_000)),
    // The bitmap is closed once it is on the GPU, so the next visit asks again (from the browser's cache).
    memo: false,
    deferred: options.deferred,
    priority: options.priority,
    run: async (report) => {
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

/** The GPU has `bitmap` now (or the section is gone): close it and take it out of the store if it is still the one held. */
export function releaseBitmap(id: string, bitmap?: ImageBitmap): void {
  const held = store.get(id);
  if (bitmap) bitmap.close();
  if (!bitmap || held === bitmap) {
    held?.close();
    store.delete(id);
  }
}
