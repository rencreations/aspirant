/**
 * The maths of the lightbox, kept apart from the component so it can be tested. Zoom and pan
 * come from the site's image viewer (`components/image-viewer/image-viewer-math`): the picture
 * is drawn at its natural size in the middle of the stage and moved and scaled with one
 * transform. This file adds the gestures on top: the double tap, the swipe, the share address.
 */
import {
  clampPan,
  clampZoom,
  fitScale,
  naturalZoom,
  wheelZoom,
  zoomAround,
  zoomPercent,
  type Box,
  type View,
} from "@/components/image-viewer/image-viewer-math";

export {
  clampPan,
  clampZoom,
  fitScale,
  naturalZoom,
  wheelZoom,
  zoomAround,
  zoomPercent,
  type Box,
  type View,
};

/** The whole picture, in the middle. */
export const FIT: View = { z: 1, x: 0, y: 0 };

/** A press that moves less than this many pixels is a tap, not a drag. */
export const TAP_SLOP = 10;
/** A swipe has to travel at least this far sideways. */
const SWIPE_MIN = 56;
/** Two taps this close in time (ms) and place (px) are a double tap. */
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 32;

export interface Tap {
  t: number;
  x: number;
  y: number;
}

export function isDoubleTap(prev: Tap | null, next: Tap): boolean {
  if (!prev) return false;
  return (
    next.t - prev.t <= DOUBLE_TAP_MS &&
    Math.hypot(next.x - prev.x, next.y - prev.y) <= DOUBLE_TAP_PX
  );
}

/**
 * What a double tap does: a zoomed picture goes back to whole, a whole one zooms in on the spot
 * (to its natural size, but never less than 2.6 times fit nor more than 4 times).
 */
export function doubleTapView(view: View, px: number, py: number, b: Box): View {
  if (view.z > 1.05) return { ...FIT };
  return zoomAround(view, Math.min(4, Math.max(2.6, naturalZoom(b))), px, py, b);
}

/**
 * A swipe sideways on a whole picture changes picture: -1 for the next one (the finger moved
 * left), 1 for the previous one, 0 when it was no swipe (too short, or more down than across).
 */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE_MIN || Math.abs(dy) >= Math.abs(dx) * 0.6) return 0;
  return dx < 0 ? -1 : 1;
}

/** A file size for people: 1.8 MB, 640 KB. Null when it is not known. */
export function formatBytes(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(n) || n <= 0) return null;
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** The upper case extension of a file name or key, without the dot (`JPG`, `PNG`). */
export function fileKind(name: string): string {
  const m = /\.([a-z0-9]{2,5})$/iu.exec(name);
  return m?.[1] ? m[1].toUpperCase() : "";
}

/** The address of the page with `?<param>=<id>` set, keeping the rest (filters, tab). */
export function shareUrl(href: string, param: string, id: string): string {
  const u = new URL(href);
  u.searchParams.set(param, id);
  u.hash = "";
  return u.toString();
}

/** Indexes of the pictures to warm around `at`, nearest first, never `at` itself, no repeats. */
export function neighbourIndexes(at: number, total: number, reach = 2): number[] {
  const out: number[] = [];
  if (total < 2) return out;
  for (let d = 1; d <= reach; d++) {
    for (const i of [(at + d) % total, (at - d + total) % total]) {
      if (i !== at && !out.includes(i)) out.push(i);
    }
  }
  return out;
}

/** The picture after `at` in `delta` steps, looping at both ends. */
export function stepIndex(at: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  return (((at + delta) % total) + total) % total;
}
