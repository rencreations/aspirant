/**
 * The maths of the captions: where the picture is, how big the text is and where the captions may
 * go. Kept apart from the component so it can be tested.
 *
 * Captions are drawn by the player (not by the browser), so the viewer can change them: the size,
 * the background and the place on the picture, like on YouTube. The place is a point, as fractions
 * of the picture (not of the screen), so it stays on the same part of the picture at any size.
 */

export type CaptionBackground = "none" | "light" | "dark" | "solid";

export interface CaptionSettings {
  /** Captions are shown. They start on. */
  on: boolean;
  /** Index into `CAPTION_SIZES`. */
  size: number;
  background: CaptionBackground;
  /** The centre of the captions, as fractions of the picture (0 left, 1 right). */
  x: number;
  /** The centre of the captions, as fractions of the picture (0 top, 1 bottom). */
  y: number;
}

export const CAPTION_SIZES = [
  { label: "Small", scale: 0.8 },
  { label: "Medium", scale: 1 },
  { label: "Large", scale: 1.4 },
  { label: "Huge", scale: 1.9 },
] as const;

export const CAPTION_BACKGROUNDS: ReadonlyArray<{ id: CaptionBackground; label: string }> = [
  { id: "none", label: "None" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "solid", label: "Solid" },
];

/**
 * The start: medium size, a dark plate, and a place that is inside the picture and clear of the
 * controls, in the lower part but not at the very bottom.
 */
export const DEFAULT_CAPTIONS: CaptionSettings = {
  on: true,
  size: 1,
  background: "dark",
  x: 0.5,
  y: 0.8,
};

/** Text is this share of the picture's height at medium size. */
const TEXT_SHARE = 0.042;
/** The text never gets smaller than this, so a phone can read it. */
const MIN_TEXT_PX = 13;
/** The captions are never wider than this share of the picture. */
export const CAPTION_MAX_WIDTH = 0.86;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where a picture of `vw` by `vh` sits when it is fitted (`object-fit: contain`) into a box of
 * `boxW` by `boxH`. With no size known yet, the whole box.
 */
export function containRect(boxW: number, boxH: number, vw: number, vh: number): Rect {
  if (vw <= 0 || vh <= 0 || boxW <= 0 || boxH <= 0) {
    return { left: 0, top: 0, width: Math.max(boxW, 0), height: Math.max(boxH, 0) };
  }
  const scale = Math.min(boxW / vw, boxH / vh);
  const width = vw * scale;
  const height = vh * scale;
  return { left: (boxW - width) / 2, top: (boxH - height) / 2, width, height };
}

/** The size of the text in pixels for a picture of this height. */
export function captionFontPx(pictureHeight: number, size: number): number {
  const entry = CAPTION_SIZES[clamp(Math.round(size), 0, CAPTION_SIZES.length - 1)]!;
  return Math.max(MIN_TEXT_PX, pictureHeight * TEXT_SHARE * entry.scale);
}

/**
 * Keep the captions on the picture. `w` and `h` are the size of the caption box in pixels and
 * `pw` and `ph` the size of the picture. The whole box stays inside, so a drag cannot push the
 * words off the edge. A box bigger than the picture stays in the middle.
 */
export function clampCaption(
  x: number,
  y: number,
  w: number,
  h: number,
  pw: number,
  ph: number,
): { x: number; y: number } {
  if (pw <= 0 || ph <= 0) return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
  const hx = Math.min(0.5, w / 2 / pw);
  const hy = Math.min(0.5, h / 2 / ph);
  return { x: clamp(x, hx, 1 - hx), y: clamp(y, hy, 1 - hy) };
}

/** Take a saved value, or anything else, and make settings from it. */
export function normalizeCaptions(raw: unknown): CaptionSettings {
  const d = DEFAULT_CAPTIONS;
  if (typeof raw !== "object" || raw === null) return { ...d };
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  const background = CAPTION_BACKGROUNDS.some((b) => b.id === r.background)
    ? (r.background as CaptionBackground)
    : d.background;
  return {
    on: typeof r.on === "boolean" ? r.on : d.on,
    size: clamp(Math.round(num(r.size, d.size)), 0, CAPTION_SIZES.length - 1),
    background,
    x: clamp(num(r.x, d.x), 0, 1),
    y: clamp(num(r.y, d.y), 0, 1),
  };
}

/** The words of a cue as lines of plain text: tags such as <i> and <c.red> are removed. */
export function cueLines(text: string): string[] {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
