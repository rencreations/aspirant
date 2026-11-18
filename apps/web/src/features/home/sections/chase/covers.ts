/**
 * The covers of the two comics in Tetra's book. They are pictures of the collection (the R2 bucket),
 * named here by key and checked against `public/data/library/comic.json` by a test. The loading
 * list's item fetches both whole (the bar counts the bytes), decodes them and keeps them for the
 * runtime, which makes the book's textures from them. A cover that never arrives leaves the book
 * with its plain pink and blue.
 */
import { libUrl } from "@/lib/library";
import { fetchWhole } from "@/lib/media-store";
import type { PreloadItem } from "@/lib/preload";
import { PermanentFailure, untilItArrives } from "@/lib/retry";

export const COMIC_COVERS = {
  /** The back cover, on the left of the open book: The Aspirants. */
  left: { slug: "the-aspirant", key: "comic/the-aspirant/cover/p.webp", bytes: 55_996 },
  /** The front cover, on the right: Vexana and Guinevere. */
  right: {
    slug: "guinevere-and-vexana",
    key: "comic/guinevere-vexana/cover/p.webp",
    bytes: 39_498,
  },
} as const;

export type CoverSide = keyof typeof COMIC_COVERS;

/** The address of a cover picture (for the plain `img` of the markup and for the fetch). */
export const coverUrl = (side: CoverSide): string => libUrl(COMIC_COVERS[side].key);

const bitmaps = new Map<CoverSide, ImageBitmap>();
let running: Promise<void> | null = null;

async function fetchOne(
  side: CoverSide,
  onBytes?: (received: number, total: number) => void,
): Promise<void> {
  if (bitmaps.has(side)) return;
  const url = coverUrl(side);
  const bitmap = await untilItArrives(async () => {
    const { blob } = await fetchWhole(url, onBytes ? { onBytes } : undefined);
    try {
      // Flipped once here: a bitmap is uploaded as it is, so the picture stands the right way up.
      return await createImageBitmap(blob, { imageOrientation: "flipY" });
    } catch (error) {
      throw new PermanentFailure(`Cannot decode ${url}: ${String(error)}`);
    }
  });
  bitmaps.set(side, bitmap);
}

/** Fetch both covers once, whoever asks first (the loading list or the runtime). Never rejects. */
export function loadCovers(
  report?: (fraction: number, bytes: { received: number; total: number }) => void,
): Promise<void> {
  if (running) return running;
  const got = new Map<CoverSide, { received: number; total: number }>();
  const tell = () => {
    let received = 0;
    let total = 0;
    got.forEach((b) => {
      received += b.received;
      total += b.total;
    });
    if (total > 0) report?.(Math.min(0.95, received / total), { received, total });
  };
  const sides: CoverSide[] = ["left", "right"];
  running = Promise.all(
    sides.map((side) =>
      fetchOne(side, (received, total) => {
        got.set(side, { received, total });
        tell();
      }).catch((error: unknown) => {
        if (!(error instanceof PermanentFailure)) throw error;
        console.warn(`[home chase] skipped the ${side} cover: ${error.message}`);
      }),
    ),
  ).then(() => undefined);
  running.catch(() => {
    running = null;
  });
  return running;
}

/** The decoded cover, or null while it has not arrived (or could not be had). */
export function coverBitmap(side: CoverSide): ImageBitmap | null {
  return bitmaps.get(side) ?? null;
}

/** The loading item: both covers, deferred (the section is far down the page). */
export function coverItem(priority = 64): PreloadItem {
  return {
    id: "home-chase-covers",
    label: "Printing the comics",
    weight: 1,
    deferred: true,
    priority,
    run: (report) => loadCovers(report),
  };
}
