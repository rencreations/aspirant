import { asset } from "@/lib/asset";
import { cachedFetch, loadMedia } from "@/lib/media-store";

/**
 * Everything the site must have before a page can show goes through this file, so the loading
 * bar reports real work and the page opens already warm. Rules:
 *
 *  - Every asset or code chunk a page needs on first paint is a `PreloadItem` in
 *    `lib/route-preloads.ts`. If it is not there, it is not in the loading bar.
 *  - Items do real work (a fetch, an image decode, a dynamic import). Never fake progress.
 *  - An item that fails or stalls never blocks the site: it resolves after `ITEM_TIMEOUT_MS`.
 */
export interface PreloadItem {
  id: string;
  /** Shown under the loading bar while the item is pending, for example "Loading the hero art". */
  label: string;
  /** Relative size of the item. Default 1. */
  weight?: number;
  /**
   * Do the work. Call `report(0..1)` while it runs (a download reports the bytes received) so
   * the bar moves smoothly instead of jumping when the item ends.
   */
  run: (report: (fraction: number) => void, context: { background: boolean }) => Promise<unknown>;
  /** How long to wait for this item before the site goes on without it. Default 12 s. */
  timeoutMs?: number;
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
}

const ITEM_TIMEOUT_MS = 12_000;
/** Deferred items download this many at a time, in the order of the list. */
const DEFERRED_AT_ONCE = 3;
/** The loading bar is told at most this often. */
const PROGRESS_EVERY_MS = 100;

interface Started {
  promise: Promise<void>;
  fraction: number;
  listeners: Set<(fraction: number) => void>;
}

const started = new Map<string, Started>();

function once(item: PreloadItem, background = false): Started {
  let s = item.memo === false ? undefined : started.get(item.id);
  if (!s) {
    const created: Started = { promise: Promise.resolve(), fraction: 0, listeners: new Set() };
    const report = (fraction: number) => {
      created.fraction = Math.min(1, Math.max(created.fraction, fraction));
      created.listeners.forEach((l) => {
        l(created.fraction);
      });
    };
    created.promise = Promise.resolve()
      .then(() => item.run(report, { background }))
      .then(
        () => undefined,
        () => undefined,
      )
      .then(() => {
        created.fraction = 1;
      });
    if (item.memo !== false) started.set(item.id, created);
    s = created;
  }
  return s;
}

/** Decode an image into the browser cache. `path` is a public path such as "/img/a.webp". */
export function imageItem(path: string, label: string, weight = 1): PreloadItem {
  return {
    id: `img:${path}`,
    label,
    weight,
    run: () =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          resolve();
        };
        img.onerror = () => {
          resolve();
        };
        img.src = asset(path);
      }),
  };
}

/** Fetch a data file into the HTTP cache. */
export function dataItem(path: string, label: string, weight = 1): PreloadItem {
  return {
    id: `data:${path}`,
    label,
    weight,
    run: () => fetch(asset(path)).then((r) => r.arrayBuffer()),
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
 * weight, and a saved copy of another size is thrown away.
 */
export function mediaItem(
  path: string,
  label: string,
  options: {
    type: string;
    bytes?: number;
    weight?: number;
    timeoutMs?: number;
    background?: boolean;
  },
): PreloadItem {
  return {
    id: `media:${path}`,
    label,
    weight: options.weight ?? Math.max(1, Math.round((options.bytes ?? 1_000_000) / 1_000_000)),
    timeoutMs: options.timeoutMs ?? 120_000,
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

/** Load a code chunk through a dynamic import. */
export function chunkItem(id: string, label: string, load: () => Promise<unknown>, weight = 2) {
  return { id: `chunk:${id}`, label, weight, run: load } satisfies PreloadItem;
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

function withTimeout(p: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, ms);
    void p.then(() => {
      window.clearTimeout(timer);
      resolve();
    });
  });
}

/**
 * Wait for `p` but never longer than `ms`. The work is not stopped: it goes on in the background
 * and what it brings in is simply late. A slow connection must never hold a visitor at a loading
 * screen for minutes.
 */
export function capWait(p: Promise<void>, ms: number): Promise<void> {
  return withTimeout(p, ms);
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
 * the items that are not `deferred` are done (or timed out). Items already finished earlier in
 * the session resolve at once. The deferred ones start when the others are in.
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
    onProgress?.({
      progress: Math.min(1, done / total),
      label: heaviest?.label ?? "Ready",
      pending: rest.map((i) => i.label),
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
      const listener = (f: number) => {
        fractions.set(item.id, f);
        if (pending.has(item.id)) emit();
      };
      s.listeners.add(listener);
      return withTimeout(s.promise, item.timeoutMs ?? ITEM_TIMEOUT_MS).then(() => {
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
