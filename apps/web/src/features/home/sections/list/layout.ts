/**
 * Where the list puts things, as pure functions of the screen. CSS pixels, origin at the top left,
 * unless a name says "stage" (origin in the middle, y up, the frame of the actors).
 */
import type { Placement, Rect as MorphRect } from "@/features/story/morph/morph-math";

import { isPortrait, type Vp } from "../vp";

import type { PictureFrame } from "./frames";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The width of a frame over its height: 4 to 5, the owner's (Oryzo's own is 85 to 110). */
export const FRAME_RATIO = 0.8;
/** The small pictures beside the frame are this share of it (Oryzo: 0.35), with a gap of 0.08 of one. */
const THUMB_SCALE = 0.35;
const THUMB_GAP = 0.08;
/** The gap between the frame and the small pictures, as a share of the frame's width (Oryzo: 0.0406). */
const SIDE_GUTTER = 0.0406;
/** The dashed line stands this far outside the frame. */
export const CHROME_PAD = 6;

export interface ListGeometry {
  /** The window every frame passes through. */
  frame: Rect;
  /** The small pictures: their size, the step from one to the next, and the two clips they pass through. */
  thumb: { w: number; h: number; pitch: number; y: number };
  left: Rect;
  right: Rect;
  /**
   * The words: `x` is the left edge, `bottom` the line above which the block stands (the top of the
   * small pictures in a wide screen, the top of the frame in a narrow one), `unit` the size of the
   * muted line (the name is 1.5 of it).
   */
  head: { x: number; bottom: number; unit: number };
  /** The hint's centre line, from the top of the screen. */
  cueY: number;
  /** True when the screen is too narrow for words beside the frame: they stand above it. */
  stacked: boolean;
  /** Stage: where a doll would sit on the frame's top edge (kept for the older carry until it is gone). */
  sitX: number;
  sitY: number;
  dollHeight: number;
}

/**
 * Oryzo's layout (`ref-oryzo.md` 7.3) in our proportions. A wide screen: the frame is 4:5, 0.8 of the
 * screen's height, centred; the small pictures stand on both sides on the middle line, the words above
 * the left ones. Nothing is added above the frame: the doll and the drone live at the bottom right.
 * A narrow screen (a phone, a small tablet): the words stand above the frame, the whole block is
 * centred between the bar and the foot, and the small pictures only peek at the sides.
 */
export function listGeometry(vp: Vp): ListGeometry {
  const portrait = isPortrait(vp);
  const wideH = 0.8 * vp.h;
  const stacked = portrait || (vp.w - wideH * FRAME_RATIO) / 2 < 330;
  const gutter = portrait ? 24 : 45;
  let h: number;
  let w: number;
  let y: number;
  let unit: number;
  let headX: number;
  let headBottom: number;
  if (!stacked) {
    h = wideH;
    w = h * FRAME_RATIO;
    y = (vp.h - h) / 2;
    unit = Math.max(16, h / 30);
    headX = Math.max(gutter, 0.03125 * vp.w);
    headBottom = 0;
  } else {
    unit = portrait ? 16 : 20;
    const headH = 2.9 * unit;
    const bar = 64;
    const foot = portrait ? 0.8 * vp.h : 0.92 * vp.h;
    const maxH = foot - bar - headH - 24;
    h = Math.min(0.72 * vp.h, maxH, (0.76 * vp.w) / FRAME_RATIO);
    w = h * FRAME_RATIO;
    const block = headH + 14 + h;
    const top = bar + Math.max(8, (foot - bar - block) / 2);
    y = top + headH + 14;
    headX = (vp.w - w) / 2;
  }
  const x = (vp.w - w) / 2;
  const frame = { x, y, w, h };
  const tw = w * THUMB_SCALE;
  const th = h * THUMB_SCALE;
  const ty = y + h / 2 - th / 2;
  const gap = SIDE_GUTTER * w;
  const leftW = Math.max(0, x - gap);
  const rightX = x + w + gap;
  headBottom = stacked ? y - 14 : ty - 0.4 * unit;
  return {
    frame,
    thumb: { w: tw, h: th, pitch: tw * (1 + THUMB_GAP), y: ty },
    left: { x: 0, y: ty, w: leftW, h: th },
    right: { x: rightX, y: ty, w: Math.max(0, vp.w - rightX), h: th },
    head: { x: headX, bottom: headBottom, unit },
    cueY: vp.h - Math.max(28, 0.035 * vp.h) - 8,
    stacked,
    sitX: x + w - 0.2 * w - vp.w / 2,
    sitY: vp.h / 2 - y - 4,
    dollHeight: (portrait ? 0.15 : 0.165) * vp.h,
  };
}

export function mixRect(a: Rect, b: Rect, u: number): Rect {
  return {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    w: a.w + (b.w - a.w) * u,
    h: a.h + (b.h - a.h) * u,
  };
}

/** Write `a` mixed with `b` into `out`, no allocation. */
export function mixRectInto(out: Rect, a: Rect, b: Rect, u: number): Rect {
  out.x = a.x + (b.x - a.x) * u;
  out.y = a.y + (b.y - a.y) * u;
  out.w = a.w + (b.w - a.w) * u;
  out.h = a.h + (b.h - a.h) * u;
  return out;
}

/**
 * How a video of the loops is laid in a 4:5 frame: the whole picture is `picW` by `picH`, the
 * frame shows the `window` (fractions of the picture). Returns the size and the offset of the
 * picture inside the frame, in the frame's own pixels.
 */
export function windowFit(
  frameW: number,
  frameH: number,
  picW: number,
  picH: number,
  win: { x: number; y: number; w: number; h: number },
): { left: number; top: number; width: number; height: number } {
  // The picture is scaled so that the window fills the frame in its width (and so in its height,
  // since the window is 4:5), then moved so the window's corner is the frame's corner.
  const width = frameW / win.w;
  const height = (width * picH) / picW;
  const k = Math.max(frameW / (win.w * width), frameH / (win.h * height));
  const w = width * k;
  const h = height * k;
  const cx = (win.x + win.w / 2) * w;
  const cy = (win.y + win.h / 2) * h;
  return { left: frameW / 2 - cx, top: frameH / 2 - cy, width: w, height: h };
}

/**
 * Where a picture that fills a box (`boxW` by `boxH`) shows when it is laid whole inside a
 * rectangle with margins: the largest fit of its ratio into `area`, centred.
 */
export function containIn(area: Rect, ratio: number, margin: number): Rect {
  const maxW = Math.max(1, area.w - 2 * margin);
  const maxH = Math.max(1, area.h - 2 * margin);
  const w = Math.min(maxW, maxH * ratio);
  const h = w / ratio;
  return { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h };
}

/** The size of the whole picture of a frame (the picture itself, not the crop). */
export function pictureSize(frame: PictureFrame): { w: number; h: number } {
  return frame.kind === "video"
    ? { w: frame.video.w, h: frame.video.h }
    : { w: frame.full.w, h: frame.full.h };
}

/** The content's placement that shows the frame's crop in the window `F`, and the whole in `T`. */
export function placements(
  frame: PictureFrame,
  F: MorphRect,
  T: MorphRect,
): { from: Placement; to: Placement } {
  const win = frame.window;
  const s0 = F.w / (win.w * T.w);
  return {
    from: { x: F.x - win.x * T.w * s0, y: F.y - win.y * T.h * s0, s: s0 },
    to: { x: T.x, y: T.y, s: 1 },
  };
}
