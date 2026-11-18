/**
 * The covers of the crate. The tracks come from the music room's own data file
 * (`public/data/library/music.json`, never edited here); a cover is a picture of the library (a
 * square) or of the site (a 16 by 9 art that is cropped to its middle square). The loading list's
 * item (`coverItems`) fetches the data and the pictures, with the bytes in the bar, and keeps them
 * decoded for the actor.
 */
import { asset } from "@/lib/asset";
import { libUrl } from "@/lib/library";
import { fetchWhole } from "@/lib/media-store";
import { dataItem, type PreloadItem } from "@/lib/preload";
import { PermanentFailure, untilItArrives } from "@/lib/retry";

import { MAX_SLEEVES } from "./facts";

/** The fields of the music data that the crate reads. The data file has more. */
interface MusicRecord {
  id: string;
  title: string;
  kind: string;
  ep: string | null;
  src: string;
  dur: number;
  cover: { t?: string; p?: string; f?: string; c?: string; site?: string };
}

export interface TrackArt {
  id: string;
  title: string;
  kind: string;
  ep: string | null;
  /** The address of the cover picture. */
  cover: string;
  /** The accent colour of the cover (`#rrggbb`), when the data has one. */
  color: string | null;
  /** The address of the song (AAC). A section plays it with `audio.playMusic`. */
  audio: string;
  /** Length in seconds. */
  dur: number;
}

const MUSIC_DATA = "/data/library/music.json";

/** The address of a cover: a library file (the 720 px one) or a picture of the site. */
export function coverAddress(cover: MusicRecord["cover"]): string {
  if (cover.site) return asset(`/${cover.site.replace(/^\/+/u, "")}`);
  const key = cover.p ?? cover.t ?? cover.f ?? "";
  return key ? libUrl(key) : "";
}

/** The first `count` tracks that have a cover, in the data's own order. */
export function pickTracks(items: readonly MusicRecord[], count: number): TrackArt[] {
  const out: TrackArt[] = [];
  const limit = Math.min(Math.max(0, Math.floor(count)), MAX_SLEEVES);
  for (const item of items) {
    if (out.length >= limit) break;
    const cover = coverAddress(item.cover);
    if (!cover) continue;
    out.push({
      id: item.id,
      title: item.title,
      kind: item.kind,
      ep: item.ep,
      cover,
      color: item.cover.c ?? null,
      audio: libUrl(item.src),
      dur: item.dur,
    });
  }
  return out;
}

/**
 * The texture window that shows the middle square of a picture `w` by `h` pixels: set it as the
 * texture's `offset` and `repeat`. A square picture gives the whole picture.
 */
export function coverCrop(
  w: number,
  h: number,
): { ox: number; oy: number; rx: number; ry: number } {
  if (!(w > 0) || !(h > 0)) return { ox: 0, oy: 0, rx: 1, ry: 1 };
  const side = Math.min(w, h);
  const rx = side / w;
  const ry = side / h;
  return { ox: (1 - rx) / 2, oy: (1 - ry) / 2, rx, ry };
}

const bitmaps = new Map<string, ImageBitmap>();
let recordsPromise: Promise<MusicRecord[]> | null = null;

/** The music records, read once (the loading list has usually fetched the file). */
function readRecords(): Promise<MusicRecord[]> {
  if (!recordsPromise) {
    const made = untilItArrives(async () => {
      const { blob } = await fetchWhole(asset(MUSIC_DATA));
      const parsed = JSON.parse(await blob.text()) as { items?: MusicRecord[] };
      if (!Array.isArray(parsed.items)) throw new PermanentFailure("music.json has no items");
      return parsed.items;
    });
    made.catch(() => {
      recordsPromise = null;
    });
    recordsPromise = made;
  }
  return recordsPromise;
}

/** The tracks of the crate: the first `count` of the music room that have a cover. */
export async function loadTracks(count: number): Promise<TrackArt[]> {
  return pickTracks(await readRecords(), count);
}

async function fetchBitmap(
  url: string,
  onBytes?: (received: number, total: number) => void,
): Promise<ImageBitmap> {
  return untilItArrives(async () => {
    const { blob } = await fetchWhole(url, onBytes ? { onBytes } : undefined);
    try {
      // Flipped once here: a bitmap is uploaded as it is, so the picture stands the right way up.
      return await createImageBitmap(blob, { imageOrientation: "flipY" });
    } catch (error) {
      throw new PermanentFailure(`Cannot decode ${url}: ${String(error)}`);
    }
  });
}

/** The decoded cover (flipped for a texture): from the loading list, or fetched now. Null when it cannot be had. */
export async function getCover(url: string): Promise<ImageBitmap | null> {
  const have = bitmaps.get(url);
  if (have) return have;
  try {
    const bitmap = await fetchBitmap(url);
    bitmaps.set(url, bitmap);
    return bitmap;
  } catch (error) {
    if (error instanceof PermanentFailure) {
      console.warn(`[records] skipped ${url}: ${error.message}`);
      return null;
    }
    throw error;
  }
}

/**
 * The loading list's items for the crate: the music data, and one item that fetches the first
 * `count` covers whole and decodes them (the bar counts their bytes together). The default is
 * `deferred`: the music section is far down the page. A cover that the server says is gone is
 * skipped (that sleeve gets a plain colour).
 */
export function coverItems(
  options: { count?: number; deferred?: boolean; priority?: number } = {},
): PreloadItem[] {
  const count = options.count ?? 10;
  const deferred = options.deferred ?? true;
  const priority = options.priority ?? 46;
  const items: PreloadItem[] = [
    dataItem(MUSIC_DATA, "Opening the record shop", 1),
    {
      id: `records-covers:${count}`,
      label: "Sleeving the records",
      weight: 1,
      run: async (report) => {
        const tracks = pickTracks(await readRecords(), count);
        const got = new Map<string, { received: number; total: number }>();
        const tell = () => {
          let received = 0;
          let total = 0;
          got.forEach((b) => {
            received += b.received;
            total += b.total;
          });
          if (total > 0) report(Math.min(0.95, received / total), { received, total });
        };
        await Promise.all(
          tracks.map(async (track) => {
            if (bitmaps.has(track.cover)) return;
            try {
              const bitmap = await fetchBitmap(track.cover, (received, total) => {
                got.set(track.cover, { received, total });
                tell();
              });
              bitmaps.set(track.cover, bitmap);
            } catch (error) {
              if (!(error instanceof PermanentFailure)) throw error;
              console.warn(`[records] skipped ${track.cover}: ${error.message}`);
            }
          }),
        );
      },
    },
  ];
  return deferred ? items.map((item) => ({ ...item, deferred: true, priority })) : items;
}
