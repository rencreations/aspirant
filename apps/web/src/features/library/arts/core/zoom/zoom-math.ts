/**
 * The pure geometry of the Arts zoom (no DOM). A picture opens from the place where its tile shows
 * it to the whole screen, and goes back the same way. The move is the window of the chapter morph
 * (`features/story/morph/morph-math.ts`): two nested clips that only translate, so the visible
 * window grows from the tile to the picture, and the picture is only ever moved and scaled
 * uniformly. Nothing is stretched and the window is always inside the picture, so no blank edge
 * shows at any moment of the move.
 *
 * A pose is where the picture stands at one moment: the window that shows it and the placement of
 * the content box (origin top left, translate then uniform scale). The content box has the size of
 * the picture contained in the screen (`Layout.box`), so the open pose has a scale of 1 and the
 * picture is drawn sharp at rest.
 */
import {
  mixPlacement,
  mixRect,
  windowFrames,
  type Box,
  type Placement,
  type Rect,
  type WindowFrames,
} from "@/features/story/morph/morph-math";

import type { FrameRect } from "../types";

export type { Box, Rect, WindowFrames };

/** `fit` shows the whole picture in the screen. `scroll` is for a tall strip: fit the width, then read it by scrolling. */
export type ZoomMode = "fit" | "scroll";

export interface Pose {
  /** The visible window, in screen pixels. */
  readonly win: Rect;
  /** Where the content box stands (origin 0 0), relative to the screen. */
  readonly c: Placement;
}

export interface Layout {
  /** The size of the content box: the picture at its open size. */
  readonly box: Box;
  /** The open pose, with the scroll at the top. */
  readonly open: Pose;
  /** A tall strip that reads by scrolling inside the viewer. */
  readonly scrollable: boolean;
  /** How far the strip scrolls, in pixels (0 when it is not scrollable). */
  readonly travel: number;
}

/** The whole picture. */
const WHOLE: FrameRect = { x: 0, y: 0, w: 1, h: 1 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The longest side of a picture that fits the screen: the whole picture, nothing cut. */
export function containBox(view: Box, aspect: number): Box {
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  const w = Math.min(view.w, view.h * a);
  return { w, h: w / a };
}

/**
 * Where a picture of `aspect` (width over height) stands when it is open on a screen of `view`.
 * `fit`: the largest size that shows all of it (the width when the picture is not taller than the
 * screen's shape, the height when it is). `scroll`: the width of the screen, and the picture is as
 * tall as it needs to be, shown from its top; a strip that is not taller than the screen is `fit`.
 */
export function openLayout(view: Box, aspect: number, mode: ZoomMode = "fit"): Layout {
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  const wide = containBox(view, a);
  if (mode === "scroll") {
    const h = view.w / a;
    if (h > view.h + 0.5) {
      return {
        box: { w: view.w, h },
        open: {
          win: { x: 0, y: 0, w: view.w, h: view.h },
          c: { x: 0, y: 0, s: 1 },
        },
        scrollable: true,
        travel: h - view.h,
      };
    }
  }
  const x = (view.w - wide.w) / 2;
  const y = (view.h - wide.h) / 2;
  return {
    box: wide,
    open: { win: { x, y, w: wide.w, h: wide.h }, c: { x, y, s: 1 } },
    scrollable: false,
    travel: 0,
  };
}

export function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const bt = Math.min(a.y + a.h, b.y + b.h);
  if (r <= x || bt <= y) return null;
  return { x, y, w: r - x, h: bt - y };
}

/** The part of `rect` that is inside the screen, from 0 to 1 of its area. */
export function visibleFraction(rect: Rect, view: Box): number {
  const area = rect.w * rect.h;
  if (area <= 0) return 0;
  const part = intersect(rect, { x: 0, y: 0, w: view.w, h: view.h });
  return part ? (part.w * part.h) / area : 0;
}

/**
 * Whether a tile at `rect` is a place the picture can fly to: it must have a size and show a
 * useful part of itself on the screen (a quarter of its area, or a patch about 140 px square).
 * Otherwise the picture fades out where it stands.
 */
export function canFlyTo(rect: Rect | null, view: Box): rect is Rect {
  if (!rect || rect.w < 2 || rect.h < 2) return false;
  const part = intersect(rect, { x: 0, y: 0, w: view.w, h: view.h });
  if (!part) return false;
  const area = part.w * part.h;
  return area >= Math.min(rect.w * rect.h * 0.25, 20000);
}

function sane(frame: FrameRect | null | undefined): FrameRect {
  if (!frame) return WHOLE;
  const { x, y, w, h } = frame;
  if (![x, y, w, h].every(Number.isFinite) || w <= 0.001 || h <= 0.001) return WHOLE;
  return { x: clamp(x, 0, 1), y: clamp(y, 0, 1), w: clamp(w, 0.001, 1), h: clamp(h, 0.001, 1) };
}

/**
 * The pose in which the content shows exactly what the tile at `rect` shows: the `frame` of the
 * picture (all of it when absent) fills the tile the way `object-fit: cover` would, centred on the
 * frame. The window is the part of the tile that is on the screen. `box` is the content box.
 */
export function sourcePose(
  rect: Rect,
  frame: FrameRect | null | undefined,
  box: Box,
  view: Box,
): Pose {
  const f = sane(frame);
  const fw = f.w * box.w;
  const fh = f.h * box.h;
  const s = Math.max(rect.w / fw, rect.h / fh);
  const cx = (f.x + f.w / 2) * box.w;
  const cy = (f.y + f.h / 2) * box.h;
  const c: Placement = {
    x: rect.x + rect.w / 2 - s * cx,
    y: rect.y + rect.h / 2 - s * cy,
    s,
  };
  const win = intersect(rect, { x: 0, y: 0, w: view.w, h: view.h }) ?? rect;
  return { win, c };
}

/** A pose shrunk toward the middle of the screen: where a picture grows from or fades to when it has no tile. */
export function fadePose(pose: Pose, view: Box, k = 0.96): Pose {
  const mx = view.w / 2;
  const my = view.h / 2;
  const pull = (v: number, m: number) => m + k * (v - m);
  return {
    win: {
      x: pull(pose.win.x, mx),
      y: pull(pose.win.y, my),
      w: pose.win.w * k,
      h: pose.win.h * k,
    },
    c: { x: pull(pose.c.x, mx), y: pull(pose.c.y, my), s: pose.c.s * k },
  };
}

/** The pose at progress `t` (0 to 1) of the eased move: both ends are mixed linearly. */
export function poseAt(from: Pose, to: Pose, t: number): Pose {
  return { win: mixRect(from.win, to.win, t), c: mixPlacement(from.c, to.c, t) };
}

/** The content box on the screen for a pose. */
export function contentRect(box: Box, pose: Pose): Rect {
  return { x: pose.c.x, y: pose.c.y, w: box.w * pose.c.s, h: box.h * pose.c.s };
}

/** Two keyframes per layer for the move from one pose to another, to be played with one easing. */
export function morphFrames(from: Pose, to: Pose, view: Box): WindowFrames {
  return windowFrames(from.win, from.c, to.win, to.c, view);
}

/** Whether `inner` lies inside `outer` (a small tolerance for rounding). */
export function contains(outer: Rect, inner: Rect, tol = 0.01): boolean {
  return (
    inner.x >= outer.x - tol &&
    inner.y >= outer.y - tol &&
    inner.x + inner.w <= outer.x + outer.w + tol &&
    inner.y + inner.h <= outer.y + outer.h + tol
  );
}

// Moves -------------------------------------------------------------------------------------

export const OPEN_MS = 680;
export const CLOSE_MS = 560;
/**
 * One easing for every layer of a move. It leaves at once (7 percent after a fifth of the time,
 * 60 percent after four tenths) and then settles for a long while (95 percent at 70 percent of the
 * time), so a press feels answered and the arrival is soft.
 */
export const EASE = "cubic-bezier(0.55, 0, 0.1, 1)";
/** The fade of a step to a neighbouring picture. */
export const STEP_MS = 280;
/** A press that comes this soon after the last one is the second half of a double press: ignored. */
export const PRESS_GRACE_MS = 320;

/** The index a step of `delta` reaches, or null at either end of the list (it does not wrap). */
export function stepIndex(index: number, delta: number, length: number): number | null {
  const next = index + delta;
  return next >= 0 && next < length ? next : null;
}

/** The indexes next to `index` whose previews are worth warming (before it, then after it). */
export function neighbourIndexes(index: number, length: number): number[] {
  const out: number[] = [];
  for (const d of [1, -1]) {
    const i = index + d;
    if (i >= 0 && i < length) out.push(i);
  }
  return out;
}

// Swipe down to close -----------------------------------------------------------------------

/** How far a drag is from letting go (0 to 1), for the backdrop. */
export function dragProgress(dy: number, height: number): number {
  return clamp(Math.abs(dy) / Math.max(1, height * 0.4), 0, 1);
}

/** A downward drag of `dy` px that ends at `velocity` px per ms closes the viewer. */
export function shouldDismiss(dy: number, velocity: number): boolean {
  return dy > 96 || (dy > 40 && velocity > 0.5);
}

/** The drag follows the finger with a little resistance (a pull upward counts for less). */
export function dragOffset(dy: number): number {
  return dy >= 0 ? dy : dy * 0.25;
}
