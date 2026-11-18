/**
 * Where the list puts things, as pure functions of the screen. CSS pixels, origin at the top left,
 * unless a name says "stage" (origin in the middle, y up, the frame of the actors).
 */
import type { Placement, Rect as MorphRect } from "@/features/story/morph/morph-math";

import { isPortrait, type Vp } from "../hand/timeline";

import type { PictureFrame } from "./frames";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The width of a frame over its height: 4 to 5, the owner's. */
export const FRAME_RATIO = 0.8;

export interface ListGeometry {
  /** The window every frame passes through. */
  frame: Rect;
  /** Stage: where the doll's hips sit, on the top edge of the frame, right of its middle. */
  sitX: number;
  sitY: number;
  /** The doll's standing height on the screen while she sits there. */
  dollHeight: number;
}

/**
 * The frame is 4:5, 0.70 of the screen's height, centred 0.58 down (the added space on top is where
 * the doll sits, under the bar). On a phone it is as wide as the screen allows.
 */
export function listGeometry(vp: Vp): ListGeometry {
  const portrait = isPortrait(vp);
  const gutter = portrait ? 24 : 45;
  const h = Math.min(0.7 * vp.h, (vp.w - 2 * gutter) / FRAME_RATIO);
  const w = h * FRAME_RATIO;
  const x = (vp.w - w) / 2;
  const y = 0.58 * vp.h - h / 2;
  const frame = { x, y, w, h };
  return {
    frame,
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
