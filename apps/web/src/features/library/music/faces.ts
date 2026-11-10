import { libUrl } from "@/lib/library";
import { fetchWhole } from "@/lib/media-store";
import type { PreloadItem } from "@/lib/preload";
import { PermanentFailure, untilItArrives } from "@/lib/retry";

import { fetchLibraryJson, libraryDataPath } from "../data";
import type { MusicFile } from "./types";

/**
 * The faces of the discs reach the scene as decoded bitmaps, made from blobs fetched with CORS,
 * so the canvas the type is drawn on is never tainted (the faces live on the library origin). The
 * loading list (`preload.ts`) fetches them; the scene takes them from here.
 */
const bitmaps = new Map<string, ImageBitmap>();
let users = 0;
let releaseTimer = 0;

async function fetchBitmap(
  key: string,
  onBytes?: (received: number, total: number) => void,
): Promise<ImageBitmap> {
  return untilItArrives(async () => {
    const { blob } = await fetchWhole(libUrl(key), onBytes ? { onBytes } : undefined);
    try {
      return await createImageBitmap(blob);
    } catch (error) {
      throw new PermanentFailure(`Cannot decode ${key}: ${String(error)}`);
    }
  });
}

/**
 * One loading list item for every face: it reads the room's data file (already in the browser
 * cache from the item before it), then fetches the nine faces at once, and the bar counts their
 * bytes together.
 */
export function discFacesItem(): PreloadItem {
  return {
    id: "music-disc-faces",
    label: "Pressing the discs",
    weight: 4,
    // Freed when the room is left; the next visit takes them from the browser cache.
    memo: false,
    run: async (report) => {
      const file = await untilItArrives(() =>
        fetchLibraryJson<MusicFile>(libraryDataPath("music")),
      );
      const keys = file.items.map((i) => i.disc).filter((k): k is string => Boolean(k));
      const got = new Map<string, { received: number; total: number }>();
      const tell = () => {
        let received = 0;
        let total = 0;
        got.forEach((b) => {
          received += b.received;
          total += b.total;
        });
        if (total > 0) report(Math.min(0.95, received / total), { received, total });
      };
      await Promise.all(
        keys.map(async (key) => {
          try {
            const bitmap = await fetchBitmap(key, (received, total) => {
              got.set(key, { received, total });
              tell();
            });
            bitmaps.get(key)?.close();
            bitmaps.set(key, bitmap);
          } catch (error) {
            // A face the server says is gone: the disc gets its plain face.
            if (!(error instanceof PermanentFailure)) throw error;
            console.warn(`[music] skipped ${key}: ${error.message}`);
          }
        }),
      );
    },
  };
}

/** The bitmap of a face: from the loading list, or fetched now. Null when it cannot be had. */
export async function getFaceBitmap(key: string | undefined): Promise<ImageBitmap | null> {
  if (!key) return null;
  const have = bitmaps.get(key);
  if (have) return have;
  try {
    const { blob } = await fetchWhole(libUrl(key));
    const bitmap = await createImageBitmap(blob);
    bitmaps.set(key, bitmap);
    return bitmap;
  } catch {
    return null;
  }
}

/** The scene uses the bitmaps until the returned function is called. */
export function holdFaceBitmaps(): () => void {
  users += 1;
  window.clearTimeout(releaseTimer);
  return () => {
    users -= 1;
    window.clearTimeout(releaseTimer);
    // A short grace period: a remount of the same page (development double mount) reuses them.
    releaseTimer = window.setTimeout(() => {
      if (users > 0) return;
      bitmaps.forEach((b) => {
        b.close();
      });
      bitmaps.clear();
    }, 1500);
  };
}
