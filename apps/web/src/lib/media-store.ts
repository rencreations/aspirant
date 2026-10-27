import { asset } from "@/lib/asset";

/**
 * Big media (the Selena videos, the music, the trailer) is downloaded whole, kept in memory as a
 * Blob and saved in the browser (Cache Storage), so that playing, seeking and swapping between
 * videos never waits on the network, and the next visit does not download it again. The loading
 * bar drives it and reports the bytes received.
 *
 * - `loadMedia` gives a file's in-memory address (an object URL). A saved copy is used when there
 *   is one and its size is right, otherwise the file is fetched, saved, and kept.
 * - `mediaUrl` gives that address once a file is loaded, and the plain address (the browser
 *   streams it) when it is not, so a file that missed the loading bar still plays.
 * - `cachedFetch` is the same saved copy for small files that are read as bytes (data, voice).
 *
 * Saving is best effort: with no Cache Storage (an insecure page, a private window) or no room,
 * everything still works from memory. The saved copy is named by `CACHE`. Change that name when a
 * file is replaced under the same address, and the old copy is thrown away.
 */
const CACHE = "aspirants-media-v4";
const CACHE_PREFIX = "aspirants-media-";

const loading = new Map<string, Promise<string>>();
const loaded = new Map<string, string>();

interface LoadOptions {
  type?: string;
  /**
   * Not needed yet: it is loaded in the background, behind everything the visitor is waiting for,
   * and never takes more than two of the download slots. `promoteMedia` makes it urgent.
   */
  background?: boolean;
  /** The size the file should have. A saved copy of another size is thrown away. */
  expectedBytes?: number;
  onFraction?: (fraction: number) => void;
}

/** A download reports its progress at most this often. */
const REPORT_EVERY_MS = 100;

/**
 * A download that gets no byte at all for this long is given up on (a dead connection holds the
 * socket open for minutes): its slot is freed and the plain address is used, so the browser
 * streams the file itself and the loading bar goes on instead of waiting behind it.
 */
export const STALL_MS = 20_000;

/**
 * At most a few big downloads run at once, in the order they were asked for. The loading screen
 * asks for the videos the stage starts with first, so they arrive first, and the network, the
 * memory and the main thread are not shared among dozens of streams. Downloads for later
 * (`background`) wait behind the urgent ones and use at most two slots, so something the visitor
 * asks for is never stuck behind them.
 */
const gate = (() => {
  const LIMIT = 4;
  const BACKGROUND_LIMIT = 2;
  let active = 0;
  let activeBackground = 0;
  interface Waiting {
    path: string;
    background: boolean;
    start: () => void;
  }
  const queue: Waiting[] = [];
  const pump = () => {
    while (active < LIMIT) {
      let i = queue.findIndex((w) => !w.background);
      if (i === -1 && activeBackground < BACKGROUND_LIMIT) i = queue.findIndex((w) => w.background);
      if (i === -1) return;
      const [w] = queue.splice(i, 1);
      w?.start();
    }
  };
  return {
    async enter(path: string, background: boolean): Promise<() => void> {
      await new Promise<void>((resolve) => {
        queue.push({
          path,
          background,
          start: () => {
            active += 1;
            if (background) activeBackground += 1;
            resolve();
          },
        });
        pump();
      });
      let background_ = background;
      return () => {
        active -= 1;
        if (background_) activeBackground -= 1;
        background_ = false;
        pump();
      };
    },
    /** Make a waiting download urgent. */
    promote(path: string) {
      for (const w of queue) if (w.path === path) w.background = false;
      pump();
    },
  };
})();

/** Something the visitor now needs: if its download is only waiting for a slot, it goes first. */
export function promoteMedia(path: string): void {
  gate.promote(asset(path));
}

let cachePromise: Promise<Cache | null> | null = null;

/** The saved store, or null when the browser has none. Older versions are removed. */
function openCache(): Promise<Cache | null> {
  cachePromise ??= (async () => {
    try {
      if (typeof caches === "undefined") return null;
      for (const name of await caches.keys()) {
        if (name.startsWith(CACHE_PREFIX) && name !== CACHE) await caches.delete(name);
      }
      return await caches.open(CACHE);
    } catch {
      return null;
    }
  })();
  return cachePromise;
}

/** A saved copy of `url`, if there is one with the right size. */
async function saved(cache: Cache | null, url: string, bytes?: number): Promise<Response | null> {
  if (!cache) return null;
  try {
    const hit = await cache.match(url);
    if (!hit) return null;
    const size = Number(hit.headers.get("content-length"));
    if (bytes && size !== bytes) {
      await cache.delete(url);
      return null;
    }
    return hit;
  } catch {
    return null;
  }
}

async function save(cache: Cache | null, url: string, body: Blob, type: string): Promise<void> {
  if (!cache) return;
  try {
    await cache.put(
      url,
      new Response(body, {
        headers: { "content-type": type, "content-length": String(body.size) },
      }),
    );
  } catch {
    // No room, or the browser refused: it still works from memory.
  }
}

/**
 * Download `path` into a Blob and return its object URL. Repeated calls share one download. A
 * saved copy is used when there is one.
 */
export function loadMedia(path: string, options: LoadOptions = {}): Promise<string> {
  const known = loaded.get(path);
  if (known) {
    options.onFraction?.(1);
    return Promise.resolve(known);
  }
  let p = loading.get(path);
  if (!p) {
    p = download(path, options).then((url) => {
      // Only a file that arrived is kept. One that failed (a stall, a dropped connection, a short
      // file) falls back to the plain address and is tried again the next time it is asked for.
      if (url.startsWith("blob:")) loaded.set(path, url);
      else loading.delete(path);
      return url;
    });
    loading.set(path, p);
  }
  return p;
}

async function download(path: string, options: LoadOptions): Promise<string> {
  const fallback = asset(path);
  try {
    const cache = await openCache();
    const hit = await saved(cache, fallback, options.expectedBytes);
    if (hit) {
      const blob = await hit.blob();
      options.onFraction?.(1);
      const type = options.type ?? blob.type;
      return URL.createObjectURL(blob.slice(0, blob.size, type));
    }
    const release = await gate.enter(fallback, options.background === true);
    let blob: Blob;
    let type: string;
    const abort = new AbortController();
    let stall = 0;
    const watch = () => {
      window.clearTimeout(stall);
      stall = window.setTimeout(() => {
        abort.abort();
      }, STALL_MS);
    };
    try {
      watch();
      const res = await fetch(fallback, { signal: abort.signal });
      if (!res.ok || !res.body) return fallback;
      const header = Number(res.headers.get("content-length"));
      const total = header > 0 ? header : (options.expectedBytes ?? 0);
      type = options.type ?? res.headers.get("content-type") ?? "video/mp4";
      // The bytes are only counted here. The browser builds the Blob itself, which is much
      // cheaper than collecting thousands of chunks in script and copying them once more.
      let received = 0;
      let lastReport = 0;
      const counter = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          watch();
          received += chunk.byteLength;
          const now = performance.now();
          if (total > 0 && now - lastReport > REPORT_EVERY_MS) {
            lastReport = now;
            options.onFraction?.(Math.min(0.999, received / total));
          }
          controller.enqueue(chunk);
        },
      });
      const body = await new Response(res.body.pipeThrough(counter)).blob();
      // A body shorter than the server said is a cut download: never keep or save half a video.
      if (header > 0 && body.size !== header) return fallback;
      blob = body.slice(0, body.size, type);
    } finally {
      window.clearTimeout(stall);
      release();
    }
    // The file counts as loaded when it is saved too.
    if (!options.expectedBytes || blob.size === options.expectedBytes) {
      await save(cache, fallback, blob, type);
    }
    return URL.createObjectURL(blob);
  } catch {
    return fallback;
  }
}

/** `fetch` that reads a saved copy first and saves what it fetches. For small files. */
export async function cachedFetch(url: string): Promise<Response> {
  const cache = await openCache();
  const hit = await saved(cache, url);
  if (hit) return hit;
  const res = await fetch(url);
  if (cache && res.ok && res.status === 200) {
    try {
      await cache.put(url, res.clone());
    } catch {
      // Best effort.
    }
  }
  return res;
}

/** The in-memory URL of a loaded file, or the plain URL. */
export function mediaUrl(path: string): string {
  return loaded.get(path) ?? asset(path);
}

/** Free everything loaded under `prefix` (when the page that needed it is left). */
export function releaseMedia(prefix: string): void {
  for (const [path, url] of Array.from(loaded)) {
    if (!path.startsWith(prefix)) continue;
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    loaded.delete(path);
    loading.delete(path);
  }
}
