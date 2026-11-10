import { libUrl } from "@/lib/library";
import { fetchWhole } from "@/lib/media-store";
import type { PreloadItem } from "@/lib/preload";
import { PermanentFailure, untilItArrives } from "@/lib/retry";

import { COVER_PX, COVER_TEXT, fitFontSize, textOn } from "./layout";

/** What a cover says: a shelf collection, or one half of the Video cover. */
export interface CoverFace {
  /** The small mono line (`01`, `02.1  VIDEO`). */
  index: string;
  name: string;
  /** The field colour, also what the ink is chosen for. */
  colour: string;
}

/**
 * The cover pictures reach the scene as decoded bitmaps, never as plain <img> elements: a bitmap
 * made from a blob that was fetched with CORS cannot taint the canvas the number and the name are
 * drawn on, whatever an earlier no-CORS request for the same address left in the browser cache.
 * The loading list (`shelfItems` in preload.ts) fetches them; the scene takes them from here.
 */
const bitmaps = new Map<string, ImageBitmap>();
let users = 0;
let releaseTimer = 0;

/** A loading list item: fetch one cover whole, with the bar counting its bytes, and decode it. */
export function coverBitmapItem(key: string, label: string, weight = 2): PreloadItem {
  return {
    id: `shelf-cover:${key}`,
    label,
    weight,
    // Freed when the shelf is left, so the next visit asks again (from the browser cache).
    memo: false,
    run: async (report) => {
      const bitmap = await untilItArrives(async () => {
        const { blob } = await fetchWhole(libUrl(key), {
          onBytes: (received, total) => {
            report(Math.min(0.95, received / total), { received, total });
          },
        });
        try {
          return await createImageBitmap(blob);
        } catch (error) {
          throw new PermanentFailure(`Cannot decode ${key}: ${String(error)}`);
        }
      });
      bitmaps.get(key)?.close();
      bitmaps.set(key, bitmap);
    },
  };
}

/** The bitmap of a cover, from the loading list or (when the list did not run) fetched now. Null when it is missing. */
export async function getCoverBitmap(key: string): Promise<ImageBitmap | null> {
  const have = bitmaps.get(key);
  if (have) return have;
  try {
    const { blob } = await fetchWhole(libUrl(key));
    const bitmap = await createImageBitmap(blob);
    bitmaps.set(key, bitmap);
    return bitmap;
  } catch {
    return null;
  }
}

/** The scene is using the bitmaps. Call the returned function when it is done with them. */
export function holdCoverBitmaps(): () => void {
  users += 1;
  window.clearTimeout(releaseTimer);
  return () => {
    users -= 1;
    window.clearTimeout(releaseTimer);
    // A short grace period: a remount of the same page (development double mount) reuses them.
    releaseTimer = window.setTimeout(() => {
      if (users > 0) return;
      bitmaps.forEach((b) => {
        b.close();
      });
      bitmaps.clear();
    }, 1500);
  };
}

const DISPLAY_FONT = '"Big Shoulders Display Variable"';
const MONO_FONT = '"JetBrains Mono Variable"';

/** Wait for the two faces the covers use. `document.fonts.ready` alone does not load an unused face. */
export async function loadCoverFonts(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all([
      document.fonts.load(`800 100px ${DISPLAY_FONT}`),
      document.fonts.load(`500 30px ${MONO_FONT}`),
    ]);
    await document.fonts.ready;
  } catch {
    // The system faces draw the text instead.
  }
}

/** Skew for the italic of the name: the site has no italic face of the display font. */
const ITALIC = -0.2;

/**
 * Draw one cover: the picture (or the room colour when the file is missing), then the number and
 * the name in the title area the picture leaves empty. Returns the canvas the scene uploads.
 */
export function drawCover(meta: CoverFace, bitmap: ImageBitmap | null): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = COVER_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = meta.colour;
  ctx.fillRect(0, 0, COVER_PX, COVER_PX);
  if (bitmap) {
    ctx.drawImage(bitmap, 0, 0, COVER_PX, COVER_PX);
  } else {
    // A missing picture still leaves a finished sleeve: a faint grid on the room colour.
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    for (let p = 128; p < COVER_PX; p += 128) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, COVER_PX);
      ctx.moveTo(0, p);
      ctx.lineTo(COVER_PX, p);
      ctx.stroke();
    }
  }

  const ink = textOn(meta.colour);
  const { x, numberY, numberSize, nameBox, nameMaxSize } = COVER_TEXT;

  // The number, small and mono, tracked out.
  ctx.save();
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.82;
  ctx.textBaseline = "top";
  ctx.font = `500 ${numberSize}px ${MONO_FONT}, ui-monospace, monospace`;
  if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = "4px";
  ctx.fillText(meta.index, x, numberY);
  ctx.restore();

  // The name: capitals, heavy, leaning right, fitted to the box.
  const name = meta.name.toUpperCase();
  const capHeight = 0.72;
  const lean = Math.abs(ITALIC);
  const fontFor = (size: number) => `800 ${size}px ${DISPLAY_FONT}, "Arial Narrow", sans-serif`;
  ctx.save();
  ctx.font = fontFor(100);
  const size = fitFontSize(
    (px) => {
      ctx.font = fontFor(px);
      return ctx.measureText(name).width + lean * capHeight * px;
    },
    nameBox.w,
    nameMaxSize,
  );
  ctx.font = fontFor(size);
  ctx.fillStyle = ink;
  ctx.textBaseline = "alphabetic";
  const baseline = nameBox.y + nameBox.h - 4;
  ctx.setTransform(1, 0, ITALIC, 1, nameBox.x, baseline);
  ctx.fillText(name, 0, 0);
  ctx.restore();
  return canvas;
}
