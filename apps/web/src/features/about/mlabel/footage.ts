import { loadMedia, promoteMedia, releaseMedia } from "@/lib/media-store";
import type { PreloadItem } from "@/lib/preload";

import { PLATE_CLIPS, PLATE_ORDER, type PlateClip } from "./assets";
import { pickOne } from "./choreo";

/**
 * The footage of the flip book. Every visit picks one clip for each of the five plates and loads
 * those five whole, into memory, so a plate never waits on the network while it flips. The page's
 * loading list and the stage both come here, so the five are downloaded once and the bytes
 * received are counted in one place (the store behind `loadMedia` tells only its first caller).
 */

interface Loading {
  clip: PlateClip;
  fraction: number;
  url: string | null;
  promise: Promise<string>;
}

let picked: readonly PlateClip[] | null = null;
const loads = new Map<string, Loading>();
const listeners = new Set<() => void>();

/** The five clips of this visit, in the order of the plates. */
export function pickedClips(): readonly PlateClip[] {
  picked ??= PLATE_ORDER.map((tone) => pickOne(PLATE_CLIPS[tone]) ?? PLATE_CLIPS[tone][0]).filter(
    (clip): clip is PlateClip => clip !== undefined,
  );
  return picked;
}

function tell(): void {
  listeners.forEach((listener) => {
    listener();
  });
}

function load(clip: PlateClip): Loading {
  let entry = loads.get(clip.src);
  if (!entry) {
    const made: Loading = {
      clip,
      fraction: 0,
      url: null,
      promise: loadMedia(clip.src, {
        type: "video/mp4",
        expectedBytes: clip.bytes,
        background: true,
        onFraction: (fraction) => {
          made.fraction = Math.max(made.fraction, fraction);
          tell();
        },
      }).then((url) => {
        made.url = url;
        made.fraction = 1;
        tell();
        return url;
      }),
    };
    loads.set(clip.src, made);
    entry = made;
  }
  return entry;
}

/** Starts the five downloads (once) and resolves with their addresses when all are in. */
export function loadFootage(): Promise<string[]> {
  return Promise.all(pickedClips().map((clip) => load(clip).promise));
}

/** The visitor is at the scene: the five go to the front of the queue. */
export function hurryFootage(): void {
  for (const clip of pickedClips()) promoteMedia(clip.src);
}

/** Bytes received over the bytes of the five, 0 to 1, and whether all are in. */
export function footageProgress(): { fraction: number; ready: boolean } {
  const clips = pickedClips();
  const total = clips.reduce((sum, clip) => sum + clip.bytes, 0) || 1;
  let got = 0;
  let ready = true;
  for (const clip of clips) {
    const entry = loads.get(clip.src);
    got += (entry?.fraction ?? 0) * clip.bytes;
    if (!entry?.url) ready = false;
  }
  return { fraction: got / total, ready };
}

/** The address a clip plays from: the copy in memory, once it is in. */
export function footageUrl(clip: PlateClip): string | null {
  return loads.get(clip.src)?.url ?? null;
}

export function onFootage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The page is left: the copies in memory are freed and the next visit picks again. */
export function dropFootage(): void {
  loads.clear();
  picked = null;
  releaseMedia("/video/about/mlabel/");
}

/**
 * The scene's footage for the page's loading list: `deferred`, so the loading screen never waits
 * for it. It comes in behind the first screen, long before the visitor reaches the end of the
 * page, and the scene itself waits for it (with the real count) if the visitor gets there first.
 * @public
 */
export function mlabelItems(): PreloadItem[] {
  return pickedClips().map((clip) => ({
    id: `media:${clip.src}`,
    label: "Loading TheMLabel",
    memo: false,
    deferred: true,
    priority: 30,
    run: (report: (fraction: number) => void) => {
      const entry = load(clip);
      const stop = onFootage(() => {
        report(entry.fraction);
      });
      return entry.promise.finally(stop);
    },
  }));
}
