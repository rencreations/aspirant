import { saveBlob } from "./download";
import { zipStore, type ZipEntry } from "./zip";

export interface DownloadItem {
  url: string;
  /** The name of the file inside the zip. */
  name: string;
}

/** How many files are fetched at the same time. */
const AT_ONCE = 4;

/**
 * Fetch every file, put them in one zip and save it. `onProgress` is told how many are in. Resolves
 * with how many files failed (they are left out of the zip); an aborted download throws.
 */
export async function downloadAll(
  items: readonly DownloadItem[],
  zipName: string,
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
): Promise<number> {
  const entries: Array<ZipEntry | null> = items.map(() => null);
  let next = 0;
  let done = 0;
  onProgress(0, items.length);
  const worker = async () => {
    for (;;) {
      const at = next++;
      const item = items[at];
      if (!item) return;
      try {
        const res = await fetch(item.url, { signal });
        if (!res.ok) throw new Error(String(res.status));
        entries[at] = { name: item.name, data: new Uint8Array(await res.arrayBuffer()) };
      } catch (error) {
        if (signal.aborted) throw error;
      }
      done += 1;
      onProgress(done, items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, items.length) }, worker));
  const got = entries.filter((e): e is ZipEntry => e !== null);
  if (got.length > 0) saveBlob(zipStore(got), zipName);
  return items.length - got.length;
}
