import { loadMedia, promoteMedia } from "@/lib/media-store";

import { roomCoreFiles, roomMedia } from "./media";
import { GUINEVERE_STAGE_BYTES } from "./timeline.generated";

/**
 * What the way into the room waits for: the welcome and the idle loop, at the size that suits the
 * display. They are big (about sixty megabytes at 2560) and the page's background queue is
 * already bringing them, so most visitors find them loaded; the others see a real bar for the rest.
 * The shorts and the zoom pose are not waited for: they follow in the background and are brought
 * forward when one is wanted.
 */

type Progress = (loaded: number, total: number) => void;

/** After this long the room starts on what it has (a slow network must not trap the visitor). */
const GIVE_UP_MS = 120_000;

let ready = false;
let pending: Promise<void> | null = null;
const listeners = new Set<Progress>();
let last: [number, number] = [0, 1];

/** True once the welcome and the idle loop of this visit's size are in memory. */
export function roomMediaReady(): boolean {
  return ready;
}

const emit = (loaded: number, total: number) => {
  last = [loaded, total];
  for (const fn of listeners) fn(loaded, total);
};

function start(): Promise<void> {
  const parts = roomCoreFiles.map((file) => ({ file, fraction: 0 }));
  const run = (async () => {
    const tier = await roomMedia.tierReady();
    const sizes = parts.map((p) => Math.max(1, GUINEVERE_STAGE_BYTES[tier][p.file] ?? 1));
    const total = sizes.reduce((a, b) => a + b, 0);
    const report = () => {
      emit(
        parts.reduce((sum, p, i) => sum + p.fraction * (sizes[i] ?? 0), 0),
        total,
      );
    };
    await Promise.all(
      parts.map((p) => {
        const path = roomMedia.path(tier, p.file);
        // Wanted now: if the background queue has not started it, it goes to the front.
        promoteMedia(path);
        return loadMedia(path, {
          type: "video/mp4",
          expectedBytes: GUINEVERE_STAGE_BYTES[tier][p.file],
          onFraction: (f) => {
            p.fraction = f;
            report();
          },
        }).then(() => {
          p.fraction = 1;
          report();
        });
      }),
    );
  })();
  const cap = new Promise<void>((resolve) => window.setTimeout(resolve, GIVE_UP_MS));
  return Promise.race([run, cap]).then(() => {
    ready = true;
    emit(1, 1);
  });
}

/**
 * Load the welcome and the idle loop. Safe to call again and again: one load is shared, and every
 * caller gets the progress of it. `onProgress` gets bytes loaded and bytes in all.
 */
export function loadRoomMedia(onProgress: Progress): Promise<void> {
  if (ready) {
    onProgress(1, 1);
    return Promise.resolve();
  }
  listeners.add(onProgress);
  onProgress(...last);
  pending ??= start();
  return pending.finally(() => {
    listeners.delete(onProgress);
  });
}
