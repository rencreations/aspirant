/**
 * The files of the stage, one registry for all of them. A picture is downloaded whole with the
 * same care as a video (`fetchWhole`: a stall or a drop is tried again, for as long as it takes),
 * then decoded, and the stage's windows learn from here whether a picture has arrived and how far
 * it is. The loading list (`preload.ts`) and the stage both ask for a picture through `loadPicture`,
 * so a file is never fetched twice: a step to a picture that the background queue has not reached
 * yet joins the download that is running, or starts it at once.
 */
import { fetchWhole } from "@/lib/media-store";
import { PermanentFailure, untilItArrives } from "@/lib/retry";
import type { ByteCount } from "@/lib/media-store";
import type { PreloadItem } from "@/lib/preload";

/** The background queue and the stage name the room's files by this group (leaving the room drops what waits). */
export const GROUP = "library-arts-splash";

export interface PictureState {
  state: "idle" | "loading" | "done" | "gone";
  /** 0 to 1 of the bytes received. */
  fraction: number;
}

interface Entry {
  snap: PictureState;
  bytes: ByteCount | undefined;
  promise: Promise<void> | null;
  listeners: Set<() => void>;
  /** The decoded picture, kept so the browser keeps it decoded. */
  img: HTMLImageElement | null;
}

const IDLE: PictureState = { state: "idle", fraction: 0 };
const entries = new Map<string, Entry>();

function entryOf(url: string): Entry {
  let e = entries.get(url);
  if (!e) {
    e = { snap: IDLE, bytes: undefined, promise: null, listeners: new Set(), img: null };
    entries.set(url, e);
  }
  return e;
}

function update(e: Entry, next: PictureState, bytes?: ByteCount): void {
  e.snap = next;
  if (bytes) e.bytes = bytes;
  e.listeners.forEach((l) => {
    l();
  });
}

/** What is known of a picture now. The same object until it changes (for `useSyncExternalStore`). */
export function pictureState(url: string): PictureState {
  return entries.get(url)?.snap ?? IDLE;
}

/** Be told when a picture's state changes. Returns the way to stop. */
export function subscribePicture(url: string, listener: () => void): () => void {
  const e = entryOf(url);
  e.listeners.add(listener);
  return () => {
    e.listeners.delete(listener);
  };
}

/** The bytes of a picture so far, for a loading bar. */
export function pictureBytes(url: string): ByteCount | undefined {
  return entries.get(url)?.bytes;
}

/** Decode a picture into the browser cache. Rejects when it cannot be decoded. */
async function decodeInto(e: Entry, url: string): Promise<void> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  e.img = img;
}

const DECODE_TRIES = 5;

/**
 * Get a picture: download it whole, decode it, and tell whoever listens. Safe to call again for the
 * same address: it joins the running download or resolves at once. A file that is gone (404 or 410)
 * ends as `gone` and the promise still resolves (nothing can fix it, and the page must not wait for it).
 */
export function loadPicture(url: string): Promise<void> {
  const e = entryOf(url);
  if (e.snap.state === "done" || e.snap.state === "gone") return Promise.resolve();
  if (e.promise) return e.promise;
  update(e, { state: "loading", fraction: Math.max(0.001, e.snap.fraction) });
  e.promise = untilItArrives(async (n) => {
    await fetchWhole(url, {
      onBytes: (received, total) => {
        update(
          e,
          { state: "loading", fraction: Math.min(0.97, received / Math.max(1, total)) },
          { received, total },
        );
      },
    });
    try {
      await decodeInto(e, url);
    } catch (error) {
      // It arrived whole and will not decode: after a few tries nothing will change.
      if (n + 1 >= DECODE_TRIES) throw new PermanentFailure(String(error));
      throw error;
    }
  }).then(
    () => {
      update(e, { state: "done", fraction: 1 });
    },
    (error: unknown) => {
      if (error instanceof PermanentFailure) {
        console.warn(`[splash] skipped ${url}: ${error.message}`);
        update(e, { state: "gone", fraction: 0 });
        return;
      }
      // Anything else was already tried again until it arrived: not reachable.
      e.promise = null;
      update(e, IDLE);
    },
  );
  return e.promise;
}

/** Let the decoded pictures go (the room is left). */
export function releasePictures(): void {
  for (const e of entries.values()) e.img = null;
}

/**
 * The size the stage draws for a pane `paneWidth` css pixels wide on a display of `ratio` device
 * pixels to a css pixel: the preview (1280) while it covers the pane, the full size above that.
 * The display decides, nothing else (never the device or the connection).
 */
export function pickSize(paneWidth: number, ratio: number): "p" | "f" {
  return paneWidth * Math.max(1, ratio) <= 1280 ? "p" : "f";
}

/**
 * One picture as an item of a loading list. Waited, or `deferred` with a `priority` (the nearest
 * pictures first). The bar moves with the bytes of the download, wherever it was started.
 */
export function pictureItem(
  url: string,
  label: string,
  options: { weight?: number; deferred?: boolean; priority?: number; group?: string } = {},
): PreloadItem {
  return {
    id: `splash:${url}`,
    label,
    weight: options.weight ?? 1,
    deferred: options.deferred ?? false,
    priority: options.priority ?? 50,
    group: options.group,
    run: (report) =>
      new Promise<void>((resolve) => {
        const tell = () => {
          const s = pictureState(url);
          report(s.fraction, pictureBytes(url));
          if (s.state === "done" || s.state === "gone") {
            off();
            resolve();
          }
        };
        const off = subscribePicture(url, tell);
        void loadPicture(url).then(tell);
        tell();
      }),
  };
}
