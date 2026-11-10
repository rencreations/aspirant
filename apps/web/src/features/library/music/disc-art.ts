import { DISC } from "./disc-shape";
import { KIND_LABEL } from "./logic";
import type { MusicItem } from "./types";

/**
 * The printed face of a disc: the picture, and the type drawn over it with the site's own fonts
 * (the ring of words along the rim, the kicker and the title).
 */
const DISPLAY = '"Big Shoulders Display Variable"';
const MONO = '"JetBrains Mono Variable"';

/** Wait for the two faces the print uses. `document.fonts.ready` alone does not load an unused face. */
export async function loadDiscFonts(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all([
      document.fonts.load(`800 100px ${DISPLAY}`),
      document.fonts.load(`500 30px ${MONO}`),
    ]);
    await document.fonts.ready;
  } catch {
    // The system faces draw the text instead.
  }
}

/** Side of the printed face, in pixels. */
const FACE_PX = 1024;

/** The words that run round the rim of a disc. */
export function rimWords(item: MusicItem): string {
  const parts = [
    "THE ASPIRANTS",
    item.ep ?? KIND_LABEL[item.kind],
    item.title,
    ...item.credits.map((c) => `${c.role} ${c.name}`),
    item.released ?? "",
    "MUSIC COLLECTION",
  ].filter(Boolean);
  return `${parts.join("  ·  ").toUpperCase()}  ·  `;
}

function setSpacing(ctx: CanvasRenderingContext2D, px: number): void {
  if ("letterSpacing" in ctx)
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

/** Draw `text` clockwise along a circle of `radius`, starting at `start` radians, until it is full. */
function ringText(
  ctx: CanvasRenderingContext2D,
  text: string,
  radius: number,
  start: number,
  spacing: number,
): void {
  const c = FACE_PX / 2;
  const full = Math.PI * 2;
  let angle = start;
  let i = 0;
  // Fill the whole ring with repeats of the words, ending on a whole word gap.
  while (angle < start + full - 0.02) {
    const ch = text[i % text.length] ?? " ";
    const w = ctx.measureText(ch).width + spacing;
    const step = w / radius;
    if (angle + step > start + full) break;
    ctx.save();
    ctx.translate(c + Math.cos(angle + step / 2) * radius, c + Math.sin(angle + step / 2) * radius);
    ctx.rotate(angle + step / 2 + Math.PI / 2);
    ctx.fillText(ch, -w / 2 + spacing / 2, 0);
    ctx.restore();
    angle += step;
    i += 1;
  }
}

/** Largest font size (down to 40) at which `measure(size)` fits `max`. */
function fitSize(measure: (size: number) => number, max: number, start: number): number {
  let size = start;
  while (size > 40 && measure(size) > max) size -= 4;
  return size;
}

/** Split a title into at most two lines of near equal length. */
export function titleLines(title: string): string[] {
  const words = title.toUpperCase().split(/\s+/u).filter(Boolean);
  if (words.length < 3 || title.length <= 16) return [words.join(" ")];
  let best = 1;
  let score = Infinity;
  for (let i = 1; i < words.length; i += 1) {
    const a = words.slice(0, i).join(" ").length;
    const b = words.slice(i).join(" ").length;
    const s = Math.abs(a - b);
    if (s < score) {
      score = s;
      best = i;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

/**
 * Print the face of one disc: the picture over the whole face, a dark band at the foot and along
 * the rim so the type reads on any picture, the ring of words along the rim, and the title. A
 * missing picture still leaves a finished face: the track's colour with the same type.
 */
export function drawFace(
  item: MusicItem,
  bitmap: ImageBitmap | null,
  ground: string,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = FACE_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const S = FACE_PX;
  const c = S / 2;

  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, S, S);
  if (bitmap) {
    const scale = Math.max(S / bitmap.width, S / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.drawImage(bitmap, (S - w) / 2, (S - h) / 2, w, h);
  } else {
    // No picture: fine circles on the colour, like the grooves of a record.
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    for (let r = c * DISC.hub + 24; r < c * DISC.faceOut; r += 22) {
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // The foot: a soft dark band under the title.
  const foot = ctx.createLinearGradient(0, S * 0.5, 0, S);
  foot.addColorStop(0, "rgba(5,7,12,0)");
  foot.addColorStop(0.6, "rgba(5,7,12,0.3)");
  foot.addColorStop(1, "rgba(5,7,12,0.5)");
  ctx.fillStyle = foot;
  ctx.fillRect(0, S * 0.5, S, S * 0.5);

  // The rim: a dark ring under the words.
  const rim = ctx.createRadialGradient(c, c, c * 0.78, c, c, c * DISC.faceOut);
  rim.addColorStop(0, "rgba(5,7,12,0)");
  rim.addColorStop(1, "rgba(5,7,12,0.5)");
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, S, S);

  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.textBaseline = "middle";
  ctx.font = `500 15px ${MONO}, ui-monospace, monospace`;
  setSpacing(ctx, 0);
  ringText(ctx, rimWords(item), c * 0.915, -Math.PI * 0.75, 2.6);

  // The kicker and the title, in the lower half, left aligned to the circle.
  const lines = titleLines(item.title);
  const base = c + c * 0.6;
  const lineH = 1;
  const font = (px: number) => `800 ${px}px ${DISPLAY}, "Arial Narrow", sans-serif`;
  const widest = (px: number) => {
    ctx.font = font(px);
    setSpacing(ctx, 0);
    return Math.max(...lines.map((l) => ctx.measureText(l).width));
  };
  // The title fits inside the circle at the height of its top line.
  const room = (y: number) => 2 * Math.sqrt(Math.max(0, (c * 0.86) ** 2 - (y - c) ** 2));
  const size = fitSize(widest, room(base - 110) * 0.74, 96);
  const top = base - (lines.length - 1) * size * lineH;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.font = font(size);
  lines.forEach((line, i) => {
    ctx.fillText(line, c, top + i * size * lineH);
  });
  ctx.font = `500 22px ${MONO}, ui-monospace, monospace`;
  setSpacing(ctx, 5);
  ctx.globalAlpha = 0.86;
  const kicker = [item.ep, KIND_LABEL[item.kind]].filter(Boolean).join("  ·  ").toUpperCase();
  ctx.fillText(kicker, c, top - size * 0.86);
  ctx.restore();
  return canvas;
}

/** The colour behind a face while it loads, and of a face without a picture. */
export function groundOf(item: MusicItem): string {
  return item.cover.c ?? "#3a2f5c";
}
