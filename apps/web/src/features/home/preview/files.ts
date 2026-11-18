/**
 * The full size pictures of the preview window. They are the heavy part of the wall (9 MB for the
 * eighteen), so they are never waited for: the loading list brings them in behind everything else,
 * and a press that comes first fetches the one it needs, sharing the download that is running. A
 * picture is held as an object URL of its whole file (so the window shows it the moment it is
 * asked, with no second request) until `releaseFull`. No three.js and no React here: the loading
 * list imports this file and it is in the bundle of every page.
 */
import { libUrl } from "@/lib/library";
import { fetchWhole } from "@/lib/media-store";
import type { PreloadItem } from "@/lib/preload";
import { PermanentFailure, untilItArrives } from "@/lib/retry";

import { PREVIEW_PICTURES, type PreviewPicture } from "./pictures";

const urls = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();
const listeners = new Set<(id: string) => void>();

/** The object URL of a picture that is already here, or null. */
export function peekFull(id: string): string | null {
  return urls.get(id) ?? null;
}

/** Tell `fn` the id of each full size picture as it arrives. Returns the way to stop. */
export function onFull(fn: (id: string) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Bring a full size picture in: from the store, from the download already running, or from a new
 * one (a stall or a drop is tried again). Null when the file is gone, so the window keeps the
 * smaller picture it already shows.
 */
export function loadFull(
  pic: PreviewPicture,
  report?: (fraction: number, bytes?: { received: number; total: number }) => void,
): Promise<string | null> {
  const have = urls.get(pic.id);
  if (have) return Promise.resolve(have);
  let running = inflight.get(pic.id);
  if (!running) {
    running = untilItArrives(() =>
      fetchWhole(libUrl(pic.f), {
        onBytes: (received, total) => {
          report?.(Math.min(0.95, received / total), { received, total });
        },
      }),
    )
      .then(({ blob }) => {
        const late = urls.get(pic.id);
        if (late) return late;
        const url = URL.createObjectURL(blob);
        urls.set(pic.id, url);
        listeners.forEach((fn) => {
          fn(pic.id);
        });
        return url;
      })
      .catch((error: unknown) => {
        if (error instanceof PermanentFailure) return null;
        throw error;
      })
      .finally(() => {
        inflight.delete(pic.id);
      });
    inflight.set(pic.id, running);
  }
  return running;
}

/** Free every full size picture (the home page is left). */
export function releaseFull(): void {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}

/**
 * The loading list's items for the full size pictures: deferred, last in the line (the visitor
 * only asks for one after a press), in the order of the wall.
 */
export function fullItems(priority = 160): PreloadItem[] {
  return PREVIEW_PICTURES.map((pic, i) => ({
    id: `home:preview:${pic.id}`,
    label: "Loading the splash art",
    weight: Math.max(1, Math.round(pic.bytes / 400_000)),
    // Freed with the page, so the next visit asks again (from the browser's own cache).
    memo: false,
    deferred: true,
    priority: priority + i * 0.01,
    run: async (report) => {
      await loadFull(pic, report);
    },
  }));
}
