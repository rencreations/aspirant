import { asset } from "@/lib/asset";
import { PermanentFailure, isGone, untilItArrives } from "@/lib/retry";

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
 * A download is never given up on because the connection is slow or bad. One that stalls (no byte
 * for `STALL_MS`), drops, or ends short of the length the server gave is dropped and started again
 * after a short wait, for as long as it takes (`lib/retry.ts`). Only a file the server says is gone
 * (HTTP 404 or 410) is skipped, and then `loadMedia` gives the plain address.
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
  /** Called as bytes arrive: the fraction done, and the bytes received of the total when known. */
  onFraction?: (fraction: number, bytes?: ByteCount) => void;
}

/** Bytes received of the bytes expected. */
export interface ByteCount {
  received: number;
  total: number;
}

/** A download reports its progress at most this often. */
const REPORT_EVERY_MS = 100;

/**
 * A download that gets no byte at all for this long is dropped (a dead connection holds the socket
 * open for minutes): its slot is freed and it is started again after a short wait.
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
      // Only a file that arrived is kept. One that is gone (HTTP 404 or 410) gives the plain
      // address and is asked for again the next time, in case it has come back.
      if (url.startsWith("blob:")) loaded.set(path, url);
      else loading.delete(path);
      return url;
    });
    loading.set(path, p);
  }
  return p;
}

interface WholeOptions {
  type?: string;
  expectedBytes?: number;
  onBytes?: (received: number, total: number) => void;
  /**
   * What an earlier try of the same file already received. A big download passes it, so a drop
   * or a stall carries on from the bytes that are in (a range request) instead of starting over.
   */
  resume?: Resume;
}

/** The bytes a download has so far, kept between tries. */
interface Resume {
  /** Bytes already moved into Blobs (the browser can keep these off the script heap). */
  parts: Blob[];
  /** Chunks not yet moved into a Blob. */
  chunks: Uint8Array[];
  chunkBytes: number;
  received: number;
  /** The strong ETag or Last-Modified of the file, so a changed file is never joined to old bytes. */
  validator: string | null;
}

function newResume(): Resume {
  return { parts: [], chunks: [], chunkBytes: 0, received: 0, validator: null };
}

function resetResume(r: Resume): void {
  r.parts = [];
  r.chunks = [];
  r.chunkBytes = 0;
  r.received = 0;
  r.validator = null;
}

/** Move the chunks into a Blob now and then, so thousands of small arrays do not pile up. */
const FLUSH_CHUNKS_AT = 4_000_000;

interface Whole {
  blob: Blob;
  headers: Headers;
}

/** "bytes 100-999/1000" gives the start and the size of the whole file. */
function readContentRange(value: string | null): { start: number; size: number } | null {
  const m = /^bytes (\d+)-\d+\/(\d+)$/.exec(value ?? "");
  return m ? { start: Number(m[1]), size: Number(m[2]) } : null;
}

/**
 * One try at fetching a whole file. Throws when the connection stalls, drops or ends short of the
 * length the server gave (the caller tries again), and throws `PermanentFailure` when the file is
 * gone. A half file is never returned. With `resume`, the bytes of an earlier try are kept, and
 * this try asks for the rest (`Range`) when the server can give it, and starts over when it cannot.
 */
export async function fetchWhole(url: string, options: WholeOptions = {}): Promise<Whole> {
  const abort = new AbortController();
  let stall = 0;
  const watch = () => {
    window.clearTimeout(stall);
    stall = window.setTimeout(() => {
      abort.abort();
    }, STALL_MS);
  };
  const resume = options.resume;
  let encodedSeen = false;
  try {
    watch();
    const start = resume?.received ?? 0;
    const headers: Record<string, string> = {};
    if (resume && start > 0) {
      headers.Range = `bytes=${start}-`;
      if (resume.validator) headers["If-Range"] = resume.validator;
    }
    const res = await fetch(url, { signal: abort.signal, headers });
    if (!res.ok) {
      if (resume && res.status === 416) resetResume(resume);
      if (isGone(res.status))
        throw new PermanentFailure(`HTTP ${res.status} for ${url}`, res.status);
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    const header = Number(res.headers.get("content-length"));
    const encoded = !!res.headers.get("content-encoding");
    encodedSeen = encoded;
    const type = options.type ?? res.headers.get("content-type") ?? "";
    const range = res.status === 206 ? readContentRange(res.headers.get("content-range")) : null;
    // Only a 206 that starts exactly where the bytes in hand end is joined to them. Anything else
    // (a 200: the server ignored the range, or the file changed) is a whole file: start over.
    const joined = !!resume && start > 0 && range?.start === start && !encoded;
    if (resume && !joined) resetResume(resume);
    const size = range ? range.size : header > 0 ? header : (options.expectedBytes ?? 0);
    let lastReport = 0;
    let blob: Blob;
    if (!resume) {
      // Small file: the bytes are only counted here. The browser builds the Blob itself.
      let received = 0;
      const counter = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          watch();
          received += chunk.byteLength;
          const now = performance.now();
          if (size > 0 && now - lastReport > REPORT_EVERY_MS) {
            lastReport = now;
            options.onBytes?.(Math.min(received, size), size);
          }
          controller.enqueue(chunk);
        },
      });
      blob = await (res.body ? new Response(res.body.pipeThrough(counter)) : res).blob();
    } else {
      if (!resume.validator) {
        const tag = res.headers.get("etag");
        resume.validator = tag && !tag.startsWith("W/") ? tag : res.headers.get("last-modified");
      }
      if (!res.body) {
        resume.parts.push(await res.blob());
        resume.received = resume.parts[0]?.size ?? 0;
      } else {
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          watch();
          resume.chunks.push(value);
          resume.chunkBytes += value.byteLength;
          resume.received += value.byteLength;
          if (resume.chunkBytes >= FLUSH_CHUNKS_AT) {
            resume.parts.push(new Blob(resume.chunks as BlobPart[]));
            resume.chunks = [];
            resume.chunkBytes = 0;
          }
          const now = performance.now();
          if (size > 0 && now - lastReport > REPORT_EVERY_MS) {
            lastReport = now;
            options.onBytes?.(Math.min(resume.received, size), size);
          }
        }
      }
      blob = new Blob([...resume.parts, ...(resume.chunks as BlobPart[])]);
    }
    // A body shorter than the server said is a cut download: never keep or save half a file. (A
    // compressed answer has the length of the compressed bytes, so only a plain one is compared.)
    if (size > 0 && !encoded && blob.size !== size) {
      if (resume) resetResume(resume);
      throw new Error(`Short answer for ${url}: ${blob.size} of ${size} bytes`);
    }
    options.onBytes?.(blob.size, blob.size);
    return { blob: type ? blob.slice(0, blob.size, type) : blob, headers: res.headers };
  } catch (error) {
    // Compressed bytes cannot be joined by a range: the next try starts over.
    if (resume && encodedSeen) resetResume(resume);
    throw error;
  } finally {
    window.clearTimeout(stall);
  }
}

async function download(path: string, options: LoadOptions): Promise<string> {
  const fallback = asset(path);
  const cache = await openCache();
  const hit = await saved(cache, fallback, options.expectedBytes);
  if (hit) {
    try {
      const blob = await hit.blob();
      options.onFraction?.(1, { received: blob.size, total: blob.size });
      const type = options.type ?? blob.type;
      return URL.createObjectURL(blob.slice(0, blob.size, type));
    } catch {
      // A saved copy that cannot be read is fetched again.
    }
  }
  // The size is known before the first byte arrives, so the loading screen can say how much there
  // is in all, not only how much of what has started.
  if (options.expectedBytes) {
    options.onFraction?.(0, { received: 0, total: options.expectedBytes });
  }
  // What has arrived is kept between tries: a drop or a stall carries on from there.
  const resume = newResume();
  let whole: Whole;
  try {
    // Each try takes a download slot and gives it back when it ends, so a download that waits to
    // try again never holds a slot.
    whole = await untilItArrives(async () => {
      const release = await gate.enter(fallback, options.background === true);
      try {
        return await fetchWhole(fallback, {
          type: options.type,
          expectedBytes: options.expectedBytes,
          resume,
          onBytes: (received, total) => {
            options.onFraction?.(Math.min(0.999, received / total), { received, total });
          },
        });
      } finally {
        release();
      }
    });
  } catch (error) {
    // The only case that is skipped: the server says the file is not there, and no retry can fix it.
    console.warn(`[media] skipped, the file is gone: ${fallback}`, error);
    return fallback;
  }
  const { blob } = whole;
  // The file counts as loaded when it is saved too.
  if (!options.expectedBytes || blob.size === options.expectedBytes) {
    await save(cache, fallback, blob, blob.type || "video/mp4");
  }
  try {
    return URL.createObjectURL(blob);
  } catch {
    // No room to hold it in memory: the page streams it from the plain address.
    return fallback;
  }
}

/**
 * `fetch` that reads a saved copy first and saves what it fetches. For small files. A try that
 * fails is made again until the file arrives; a file the server says is gone gives its 404 or 410.
 */
export async function cachedFetch(url: string): Promise<Response> {
  const cache = await openCache();
  const hit = await saved(cache, url);
  if (hit) return hit;
  let whole: Whole;
  try {
    whole = await untilItArrives(() => fetchWhole(url));
  } catch (error) {
    if (error instanceof PermanentFailure) return new Response(null, { status: error.status });
    throw error;
  }
  const type = whole.headers.get("content-type") ?? "";
  const res = new Response(whole.blob, {
    status: 200,
    headers: {
      ...(type ? { "content-type": type } : {}),
      "content-length": String(whole.blob.size),
    },
  });
  if (cache) {
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
