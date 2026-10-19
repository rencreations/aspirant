import { asset } from "@/lib/asset";

/**
 * Big media (the Selena videos) is downloaded whole into memory, so that playing, seeking and
 * swapping between videos never waits on the network. The loading bar drives it and reports the
 * bytes received. `mediaUrl` gives the in-memory address once a file is loaded, and the plain
 * address (the browser streams it) when it is not, so a file that missed the loading bar still
 * plays.
 */
const loading = new Map<string, Promise<string>>();
const loaded = new Map<string, string>();

interface LoadOptions {
  type?: string;
  expectedBytes?: number;
  onFraction?: (fraction: number) => void;
}

/** Download `path` into a Blob and return its object URL. Repeated calls share one download. */
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
    const res = await fetch(fallback);
    if (!res.ok || !res.body) return fallback;
    const header = Number(res.headers.get("content-length"));
    const total = header > 0 ? header : (options.expectedBytes ?? 0);
    const reader = res.body.getReader();
    const chunks: BlobPart[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      if (total > 0) options.onFraction?.(Math.min(0.999, received / total));
    }
    const type = options.type ?? res.headers.get("content-type") ?? "video/mp4";
    return URL.createObjectURL(new Blob(chunks, { type }));
  } catch {
    return fallback;
  }
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
