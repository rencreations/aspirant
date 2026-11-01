import { asset } from "@/lib/asset";
import { isChunkError, reloadOnce } from "@/lib/chunk-guard";
import { cachedFetch, fetchWhole, loadMedia, type ByteCount } from "@/lib/media-store";
import { isOffline } from "@/lib/offline";
import { PermanentFailure, untilItArrives } from "@/lib/retry";

/**
 * Everything the site must have before a page can show goes through this file, so the loading
 * bar reports real work and the page opens already warm. Rules:
 *
 *  - Every asset or code chunk a page needs on first paint is a `PreloadItem` in
 *    `lib/route-preloads.ts`. If it is not there, it is not in the loading bar.
 *  - Items do real work (a fetch, an image decode, a dynamic import). Never fake progress.
 *  - One version only. An item is never given up on because the connection is slow or bad: a
 *    download that fails or stalls is tried again until it arrives (`lib/retry.ts`), so the loading
 *    screen waits as long as it takes and the page opens with everything. The only item that is
 *    skipped is one the server says is gone (HTTP 404 or 410) or a picture that arrives and cannot
 *    be decoded again and again: nothing can fix those, and one missing file must not hold every
 *    visitor for ever. It is logged.
 */
export interface PreloadItem {
  id: string;
  /** Shown under the loading bar while the item is pending, for example "Loading the hero art". */
  label: string;
  /** Relative size of the item. Default 1. */
  weight?: number;
  /**
   * Do the work. Call `report(0..1)` while it runs (a download reports the bytes received, and
   * the bytes themselves as a second argument) so the bar moves smoothly instead of jumping when
   * the item ends.
   */
  run: (
    report: (fraction: number, bytes?: ByteCount) => void,
    context: { background: boolean },
  ) => Promise<unknown>;
  /**
   * Remember the item for the session, so a second list that has it does not run it again.
   * Default true. Media turns it off: it is freed when its page is left, and the next visit
   * has to load it again (from the saved copy, which is quick).
   */
  memo?: boolean;
  /**
   * Not needed at first paint. The loading bar does not wait for it: it starts once everything
   * else is in, a few at a time, and whatever uses it waits for it then (a button shows that it
   * is loading). Only for things the page does not show until the visitor asks for them.
   */
  deferred?: boolean;
  /** Deferred items start in this order, the smallest first. Default 50. */
  priority?: number;
  /** Who wants it (a character's name), so leaving that page can drop what is still waiting. */
  group?: string;
}

export interface PreloadProgress {
  /** 0 to 1, by weight of finished items. */
  progress: number;
  /** The heaviest item still running, or "Ready". */
  label: string;
  /** Every item still running. */
  pending: readonly string[];
  /**
   * Bytes received of the bytes expected, over the items that know their size. `partial` is true
   * while some download has not said how big it is yet, so the total is not the whole yet.
   */
  bytes?: ByteCount & { partial: boolean };
}

/** A picture that arrives whole and still cannot be decoded this many times is skipped. */
const DECODE_TRIES = 5;
/** Deferred items download this many at a time, in the order of the list. */
const DEFERRED_AT_ONCE = 3;
/** The loading bar is told at most this often. */
const PROGRESS_EVERY_MS = 100;

interface Started {
  promise: Promise<void>;
  fraction: number;
  bytes?: ByteCount;
  listeners: Set<(fraction: number, bytes?: ByteCount) => void>;
}

const started = new Map<string, Started>();

function once(item: PreloadItem, background = false): Started {
  let s = item.memo === false ? undefined : started.get(item.id);
  if (!s) {
    const created: Started = { promise: Promise.resolve(), fraction: 0, listeners: new Set() };
    const report = (fraction: number, bytes?: ByteCount) => {
      created.fraction = Math.min(1, Math.max(created.fraction, fraction));
      // A try that starts again counts from nothing: what is shown never goes back.
      if (bytes && bytes.received >= (created.bytes?.received ?? 0)) created.bytes = bytes;
      created.listeners.forEach((l) => {
        l(created.fraction, created.bytes);
      });
    };
    created.promise = Promise.resolve()
      .then(() => item.run(report, { background }))
      .then(
        () => undefined,
        (error: unknown) => {
          // Only a file that is gone for good ends up here (see the top of this file).
          if (error instanceof PermanentFailure) {
            console.warn(`[preload] skipped ${item.id}: ${error.message}`);
          }
        },
      )
      .then(() => {
        created.fraction = 1;
      });
    if (item.memo !== false) started.set(item.id, created);
    s = created;
  }
  return s;
}

/** Load a picture from the address, to put it in the browser cache. Rejects when it cannot be decoded. */
function decodeImage(url: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      resolve();
    };
    img.onerror = () => {
      reject(new Error(`Cannot decode ${url}`));
    };
    img.src = url;
  });
}

/**
 * Fetch a picture whole, with the same care as a video (a stall or a drop is tried again), then
 * decode it into the browser cache. `path` is a public path such as "/img/a.webp".
 */
export function imageItem(path: string, label: string, weight = 1): PreloadItem {
  return {
    id: `img:${path}`,
    label,
    weight,
    run: (report) => {
      const url = asset(path);
      return untilItArrives(async (n) => {
        await fetchWhole(url, {
          onBytes: (received, total) => {
            report(Math.min(0.95, received / total), { received, total });
          },
        });
        try {
          await decodeImage(url);
        } catch (error) {
          // It arrived whole and will not decode: after a few tries nothing will change.
          if (n + 1 >= DECODE_TRIES) throw new PermanentFailure(String(error));
          throw error;
        }
      });
    },
  };
}

/** Fetch a data file into the HTTP cache. */
export function dataItem(path: string, label: string, weight = 1): PreloadItem {
  return {
    id: `data:${path}`,
    label,
    weight,
    run: (report) =>
      untilItArrives(() =>
        fetchWhole(asset(path), {
          onBytes: (received, total) => {
            report(Math.min(0.95, received / total), { received, total });
          },
        }),
      ),
  };
}

/**
 * Fetch a small file that the audio engine reads (a voice line) and save it in the browser. The
 * engine reads it through the same saved copy.
 */
export function savedItem(path: string, label: string, weight = 1): PreloadItem {
  return {
    id: `saved:${path}`,
    label,
    weight,
    run: () => cachedFetch(asset(path)).then((r) => r.arrayBuffer()),
  };
}

/**
 * Download a big file whole (a video, the music), keep it in memory and save it in the browser.
 * The bar moves with the bytes received. Pass `bytes` when the size is known: it sets the
 * weight, and a saved copy of another size is thrown away. It waits as long as the download takes.
 */
export function mediaItem(
  path: string,
  label: string,
  options: {
    type: string;
    bytes?: number;
    weight?: number;
    background?: boolean;
  },
): PreloadItem {
  return {
    id: `media:${path}`,
    label,
    weight: options.weight ?? Math.max(1, Math.round((options.bytes ?? 1_000_000) / 1_000_000)),
    memo: false,
    run: (report, context) =>
      loadMedia(path, {
        type: options.type,
        expectedBytes: options.bytes,
        onFraction: report,
        background: options.background ?? context.background,
      }),
  };
}

/**
 * Load a code chunk through a dynamic import. A chunk that fails to load is tried again. After a
 * few tries on a connection that is up, the file is taken as gone (a new deploy replaced it): the
 * page reloads once to fetch the new one (`lib/chunk-guard.ts` stops a loop).
 */
export function chunkItem(
  id: string,
  label: string,
  load: () => Promise<unknown>,
  weight = 2,
): PreloadItem {
  return {
    id: `chunk:${id}`,
    label,
    weight,
    run: () =>
      untilItArrives(async (n) => {
        try {
          return await load();
        } catch (error) {
          if (n >= 2 && !isOffline() && isChunkError(error)) reloadOnce();
          throw error;
        }
      }),
  };
}

/** Wait for the web fonts the site uses. */
export function fontsItem(): PreloadItem {
  return {
    id: "fonts",
    label: "Loading type",
    weight: 1,
    run: async () => {
      if (typeof document === "undefined" || !("fonts" in document)) return;
      await Promise.all([
        document.fonts.load('700 1em "Big Shoulders Display Variable"'),
        document.fonts.load('400 1em "Hanken Grotesk Variable"'),
        document.fonts.load('400 1em "JetBrains Mono Variable"'),
        document.fonts.load('italic 400 1em "Instrument Serif"'),
      ]);
      await document.fonts.ready;
    },
  };
}

/**
 * The background queue. Every page that asks adds to the same queue (an item that is in it or was
 * started already is not added twice), so the work never runs more than `DEFERRED_AT_ONCE` wide
 * however many times a list is asked for. It runs in order of `priority`, and goes on after the
 * loading screen has gone and the page is open. Nothing waits for it and nothing fails.
 */
const deferredQueue: PreloadItem[] = [];
const deferredSeen = new Set<string>();
let deferredRunning = 0;

function pumpDeferred(): void {
  while (deferredRunning < DEFERRED_AT_ONCE) {
    const item = deferredQueue.shift();
    if (!item) return;
    deferredRunning += 1;
    void once(item, true).promise.then(() => {
      // A file that is freed when its page is left has to be asked for again on the next visit.
      if (item.memo === false) deferredSeen.delete(item.id);
      deferredRunning -= 1;
      pumpDeferred();
    });
  }
}

function runDeferred(items: readonly PreloadItem[]): void {
  for (const item of items) {
    if (deferredSeen.has(item.id)) continue;
    deferredSeen.add(item.id);
    // Stable insertion by priority.
    const p = item.priority ?? 50;
    let at = deferredQueue.length;
    while (at > 0 && (deferredQueue[at - 1]?.priority ?? 50) > p) at -= 1;
    deferredQueue.splice(at, 0, item);
  }
  pumpDeferred();
}

/**
 * Forget what is still waiting in the background queue for `group` (the visitor left its page).
 * What has started carries on, and a later visit asks for the rest again.
 */
export function cancelDeferred(group: string): void {
  for (let i = deferredQueue.length - 1; i >= 0; i -= 1) {
    const item = deferredQueue[i];
    if (item?.group !== group) continue;
    deferredSeen.delete(item.id);
    deferredQueue.splice(i, 1);
  }
}

/**
 * Run items in parallel and report progress as bytes arrive and items finish. Resolves when all
 * the items that are not `deferred` are done, however long that takes. Items already finished
 * earlier in the session resolve at once. The deferred ones start when the others are in.
 */
export async function runPreload(
  items: readonly PreloadItem[],
  onProgress?: (p: PreloadProgress) => void,
): Promise<void> {
  const all = Array.from(new Map(items.map((i) => [i.id, i])).values());
  const unique = all.filter((i) => !i.deferred);
  const later = all.filter((i) => i.deferred);
  const total = unique.reduce((sum, i) => sum + (i.weight ?? 1), 0) || 1;
  const pending = new Map(unique.map((i) => [i.id, i]));
  const fractions = new Map<string, number>();
  const counts = new Map<string, ByteCount>();

  const flush = () => {
    const rest = Array.from(pending.values());
    let done = 0;
    for (const i of unique) {
      const f = pending.has(i.id) ? (fractions.get(i.id) ?? 0) : 1;
      done += (i.weight ?? 1) * f;
    }
    const heaviest = rest.reduce<PreloadItem | undefined>(
      (best, i) => ((i.weight ?? 1) > (best?.weight ?? 0) ? i : best),
      undefined,
    );
    let received = 0;
    let expected = 0;
    for (const [id, count] of counts) {
      expected += count.total;
      received += pending.has(id) ? count.received : count.total;
    }
    // Pictures, data and media say their size once they start (media says it at once when the list
    // knows it). Until every one of them has, the total is only what is known so far.
    const partial = rest.some((i) => /^(img|data|media):/.test(i.id) && !counts.has(i.id));
    onProgress?.({
      progress: Math.min(1, done / total),
      label: heaviest?.label ?? "Ready",
      pending: rest.map((i) => i.label),
      ...(expected > 0 ? { bytes: { received, total: expected, partial } } : {}),
    });
  };
  // Progress arrives with every chunk of every download, thousands of times a second. The bar
  // needs about ten updates a second: more only costs the loading screen its smoothness.
  let timer = 0;
  const emit = () => {
    if (timer) return;
    timer = window.setTimeout(() => {
      timer = 0;
      flush();
    }, PROGRESS_EVERY_MS);
  };
  flush();

  await Promise.all(
    unique.map((item) => {
      const s = once(item);
      const listener = (f: number, b?: ByteCount) => {
        fractions.set(item.id, f);
        if (b) counts.set(item.id, b);
        if (pending.has(item.id)) emit();
      };
      if (s.bytes) counts.set(item.id, s.bytes);
      s.listeners.add(listener);
      return s.promise.then(() => {
        s.listeners.delete(listener);
        pending.delete(item.id);
        emit();
      });
    }),
  );
  window.clearTimeout(timer);
  timer = 0;
  flush();
  runDeferred(later);
}
