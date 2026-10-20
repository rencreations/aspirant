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
const CACHE = "aspirants-media-v2";
const CACHE_PREFIX = "aspirants-media-";

const loading = new Map<string, Promise<string>>();
const loaded = new Map<string, string>();

interface LoadOptions {
  type?: string;
  /** The size the file should have. A saved copy of another size is thrown away. */
  expectedBytes?: number;
  onFraction?: (fraction: number) => void;
}

/** A download reports its progress at most this often. */
const REPORT_EVERY_MS = 100;

/**
 * At most a few big downloads run at once, in the order they were asked for. The loading screen
 * asks for the videos the stage starts with first, so they arrive first, and the network, the
 * memory and the main thread are not shared among dozens of streams.
 */
const gate = (() => {
  const LIMIT = 4;
  let active = 0;
  const queue: Array<() => void> = [];
  return {
    async enter(): Promise<() => void> {
      if (active >= LIMIT) await new Promise<void>((resolve) => queue.push(resolve));
      else active += 1;
      return () => {
        const next = queue.shift();
        if (next) next();
        else active -= 1;
      };
    },
  };
})();

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
      loaded.set(path, url);
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
    const release = await gate.enter();
    let blob: Blob;
    let type: string;
    try {
      const res = await fetch(fallback);
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
      blob = body.slice(0, body.size, type);
    } finally {
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
