/**
 * The pure geometry of the chapter morph (no DOM). Every move is a transform: the window that
 * opens from the card to the screen is two nested clips that only translate, so nothing is ever
 * stretched, and every transform of a morph is linear in its eased progress. Two keyframes and one
 * easing therefore give the exact picture at every frame (no sampled keyframes are needed).
 *
 *   outer   (overflow hidden, the size of the screen)   translate(win.x, win.y)
 *   inner   (overflow hidden, the size of the screen)   translate(win.w - full.w, win.h - full.h)
 *   counter                                             translate(-(outer + inner))
 *   content (the title card's picture, origin 0 0)      translate(c.x, c.y) scale(c.s)
 *
 * The outer box clips the left and top edges, the inner box the right and bottom ones, and the
 * counter puts the content back in screen space, where it sits at `c` whatever the window does.
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Box {
  readonly w: number;
  readonly h: number;
}

/** A box of the screen's size placed at (x, y) and scaled uniformly by s (origin top left). */
export interface Placement {
  readonly x: number;
  readonly y: number;
  readonly s: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** A CSS object-position ("60% 40%", "center", "left top") as fractions of the box. */
export function parseFocus(focus: string | null | undefined): Point {
  const words: Record<string, number> = { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 };
  const parts = (focus ?? "").trim().split(/\s+/u).filter(Boolean);
  const value = (part: string | undefined): number => {
    if (part === undefined) return 0.5;
    if (part in words) return words[part] ?? 0.5;
    const n = Number.parseFloat(part);
    return Number.isFinite(n) && part.endsWith("%") ? clamp(n / 100, 0, 1) : 0.5;
  };
  const [a, b] = parts;
  // "top" or "bottom" alone, or first, names the vertical axis.
  if (a === "top" || a === "bottom") return { x: value(b), y: value(a) };
  return { x: value(a), y: value(b) };
}

/**
 * Where the card at the foot of a chapter puts its stage: a box of the title card's size (`view`)
 * scaled down to fill the card, shifted so the picture's focus point sits in the middle of the
 * band the card shows (clamped, so the band never leaves the picture). `x` and `y` are relative to
 * the card's top left corner.
 */
export function stageFit(card: Box, view: Box, focus: Point): Placement {
  const s = Math.max(card.w / view.w, card.h / view.h);
  const bandW = card.w / s;
  const bandH = card.h / s;
  const ox = clamp(focus.x * view.w - bandW / 2, 0, Math.max(0, view.w - bandW));
  const oy = clamp(focus.y * view.h - bandH / 2, 0, Math.max(0, view.h - bandH));
  return { x: -ox * s, y: -oy * s, s };
}

export function mixRect(a: Rect, b: Rect, t: number): Rect {
  return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), w: mix(a.w, b.w, t), h: mix(a.h, b.h, t) };
}

export function mixPlacement(a: Placement, b: Placement, t: number): Placement {
  return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), s: mix(a.s, b.s, t) };
}

/** The four layers of the window for one moment: translations, and the content's placement. */
export interface ClipLayers {
  readonly outer: Point;
  readonly inner: Point;
  readonly counter: Point;
  readonly content: Placement;
}

/** The layers that show `content` through a window `win` (both in screen pixels). */
export function clipLayers(win: Rect, content: Placement, full: Box): ClipLayers {
  const w = Math.min(win.w, full.w);
  const h = Math.min(win.h, full.h);
  const outer = { x: win.x, y: win.y };
  const inner = { x: w - full.w, y: h - full.h };
  return {
    outer,
    inner,
    counter: { x: -(outer.x + inner.x), y: -(outer.y + inner.y) },
    content,
  };
}

/** What the layers show on screen: the visible window and where the content box lands. */
export function composeLayers(layers: ClipLayers, full: Box): { win: Rect; content: Placement } {
  const ox = layers.outer.x;
  const oy = layers.outer.y;
  const ix = ox + layers.inner.x;
  const iy = oy + layers.inner.y;
  const left = Math.max(ox, ix);
  const top = Math.max(oy, iy);
  const right = Math.min(ox + full.w, ix + full.w);
  const bottom = Math.min(oy + full.h, iy + full.h);
  const cx = ix + layers.counter.x;
  const cy = iy + layers.counter.y;
  return {
    win: { x: left, y: top, w: right - left, h: bottom - top },
    content: { x: cx + layers.content.x, y: cy + layers.content.y, s: layers.content.s },
  };
}

const px = (n: number) => `${Math.round(n * 100) / 100}px`;

const translate = (p: Point) => `translate(${px(p.x)}, ${px(p.y)})`;

export const place = (p: Placement) =>
  `translate(${px(p.x)}, ${px(p.y)}) scale(${Math.round(p.s * 1e5) / 1e5})`;

/** Two keyframes per layer (from, to), to be played with one easing. */
export interface WindowFrames {
  readonly outer: [string, string];
  readonly inner: [string, string];
  readonly counter: [string, string];
  readonly content: [string, string];
  /** The card's own shade, stretched with the window (a gradient, so stretching is harmless). */
  readonly shade: [string, string];
}

/**
 * Keyframes that open the window from `fromWin` (showing the content at `fromContent`) to
 * `toWin` (showing it at `toContent`). Every layer is linear in the eased progress, so the
 * browser's interpolation between the two keyframes is exact at every frame.
 */
export function windowFrames(
  fromWin: Rect,
  fromContent: Placement,
  toWin: Rect,
  toContent: Placement,
  full: Box,
  shadeBox: Box = { w: fromWin.w, h: fromWin.h },
): WindowFrames {
  const a = clipLayers(fromWin, fromContent, full);
  const b = clipLayers(toWin, toContent, full);
  const shade = (r: Rect) =>
    `translate(${px(r.x)}, ${px(r.y)}) scale(${Math.round((r.w / shadeBox.w) * 1e5) / 1e5}, ${
      Math.round((r.h / shadeBox.h) * 1e5) / 1e5
    })`;
  return {
    outer: [translate(a.outer), translate(b.outer)],
    inner: [translate(a.inner), translate(b.inner)],
    counter: [translate(a.counter), translate(b.counter)],
    content: [place(a.content), place(b.content)],
    shade: [shade(fromWin), shade(toWin)],
  };
}

/**
 * The transform (origin 0 0) that puts a word laid out at its final place over the same word in
 * the card. `from` and `to` are the rectangles of the word's glyphs (its text, not its box), `box`
 * the top left of the final element's box, and `k` the ratio of the two font sizes. At progress 1
 * the transform is none.
 */
export function wordFlip(from: Rect, to: Rect, box: Point, k: number): Placement {
  const dx = to.x - box.x;
  const dy = to.y - box.y;
  return { x: from.x - box.x - k * dx, y: from.y - box.y - k * dy, s: k };
}

/** Where a box point lands under `place(p)` with origin at `box`. */
export function applyFlip(p: Placement, box: Point, point: Point): Point {
  return { x: box.x + p.x + p.s * (point.x - box.x), y: box.y + p.y + p.s * (point.y - box.y) };
}

/** A CSS cubic-bezier as a function of time (0..1), and its string. */
export interface Easing {
  readonly css: string;
  (t: number): number;
}

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const bx = (u: number) => 3 * x1 * u * (1 - u) ** 2 + 3 * x2 * u ** 2 * (1 - u) + u ** 3;
  const by = (u: number) => 3 * y1 * u * (1 - u) ** 2 + 3 * y2 * u ** 2 * (1 - u) + u ** 3;
  const fn = ((t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i += 1) {
      const mid = (lo + hi) / 2;
      if (bx(mid) < t) lo = mid;
      else hi = mid;
    }
    return by((lo + hi) / 2);
  }) as Easing;
  Object.defineProperty(fn, "css", { value: `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})` });
  return fn;
}

/** The first time (0..1) at which `easing` reaches `value` (it must rise monotonically). */
export function timeAt(easing: (t: number) => number, value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (easing(mid) < value) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The fraction of the move at which a window edge going from `from` to `to` crosses `at`. */
export function crossing(from: number, to: number, at: number): number {
  if (from === to) return from <= at ? 0 : 1;
  return clamp((at - from) / (to - from), 0, 1);
}
