/**
 * The arithmetic of the dive into a comic (see dive.tsx). Everything here is a plain function of
 * numbers, so it is tested without a browser.
 *
 * The camera is one scale `k` about one point, the pivot. A part of the stage that stands at depth
 * `d` is scaled by `k ** exponent(d)` about the same pivot, so the layers in front rush past and the
 * ones behind hang back: a parallax zoom. The first panel is the one that is brought to fill the
 * screen, so its scale is `k` exactly.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function centreOf(box: Box): Point {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

/** Where a point lands when the camera scales by `k` about `pivot`. */
export function zoomed(p: Point, pivot: Point, k: number): Point {
  return { x: pivot.x + k * (p.x - pivot.x), y: pivot.y + k * (p.y - pivot.y) };
}

/**
 * The scale and the pivot that turn `box` into a box that is centred in `view` and covers it (the
 * panel fills the screen, nothing of the screen is left uncovered).
 */
export function coverCamera(box: Box, view: Box): { k: number; pivot: Point } {
  const k = Math.max(view.w / box.w, view.h / box.h);
  const c = centreOf(box);
  const t = centreOf(view);
  // k * (c - F) + F = t, so F = (t - k * c) / (1 - k).
  const d = 1 - k;
  if (Math.abs(d) < 1e-6) return { k: 1, pivot: c };
  return { k, pivot: { x: (t.x - k * c.x) / d, y: (t.y - k * c.y) / d } };
}

/**
 * The move, in the part's own frame, of a part whose centre stands at `centre` on the screen and
 * which is turned by `rotation` degrees: scaled by `k` about `pivot`, it must end with its centre at
 * `zoomed(centre)`. The `transform` of an element is applied inside the turn of its `rotate`, so the
 * move on the screen is turned back by the part's rotation.
 */
export function partShift(centre: Point, pivot: Point, k: number, rotation = 0): Point {
  const sx = (k - 1) * (centre.x - pivot.x);
  const sy = (k - 1) * (centre.y - pivot.y);
  const a = (-rotation * Math.PI) / 180;
  return { x: sx * Math.cos(a) - sy * Math.sin(a), y: sx * Math.sin(a) + sy * Math.cos(a) };
}

/**
 * How much a part is zoomed, as a power of the camera's scale: 1 for the first panel, more for the
 * parts in front of it, less for the parts behind it (never below `floor`, so nothing stands still).
 */
export function zoomExponent(
  depth: number,
  firstDepth: number,
  spread = 0.55,
  floor = 0.25,
): number {
  return Math.max(floor, 1 + spread * (depth - firstDepth));
}

/** Ease in and out, slow at the start, quick in the middle, a soft stop. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * The scales of one part over the dive, sampled so that a plain linear tween between them is a
 * zoom that feels even: a camera moves by a ratio, not by a fixed amount, so each sample is
 * `kEnd ** ease(t)`.
 */
export function zoomSamples(kEnd: number, steps: number, ease = easeInOut): number[] {
  const out: number[] = [];
  for (let i = 0; i <= steps; i += 1) out.push(kEnd ** ease(i / steps));
  return out;
}

/**
 * The size of a box that is turned by `deg` degrees (a small turn), from the size of the box that
 * holds it on the screen. A turned box is wider and taller than it is.
 */
export function unturnedSize(w: number, h: number, deg: number): { w: number; h: number } {
  const a = (Math.abs(deg) * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const d = cos * cos - sin * sin;
  if (Math.abs(d) < 1e-6) return { w, h };
  return { w: (w * cos - h * sin) / d, h: (h * cos - w * sin) / d };
}

/** A panel as it stands on the stage: the box of its picture on the screen, and where its cut sits on its page. */
export interface PanelFit {
  /** The picture's box on the screen, before the camera. */
  box: Box;
  /** The size of the cut, in the page's pixels. */
  cut: { w: number; h: number };
  /** The cut's left and top, in the page's pixels. */
  at: { x: number; y: number };
}

/**
 * Where the page itself stands once the camera has zoomed the panel by `k` about `pivot`: the screen
 * position of the page's top left corner and how many screen pixels one page pixel is. The picture
 * is drawn with `object-fit: cover` and a centred position, which is what this follows.
 */
export function pageAfterZoom(
  fit: PanelFit,
  pivot: Point,
  k: number,
): { x: number; y: number; scale: number } {
  const c = Math.max(fit.box.w / fit.cut.w, fit.box.h / fit.cut.h);
  // The cut's pixel that stands at the picture's left and top edge.
  const ox = (fit.cut.w - fit.box.w / c) / 2;
  const oy = (fit.cut.h - fit.box.h / c) / 2;
  // The page's own corner, before the camera.
  const corner = { x: fit.box.x - (fit.at.x + ox) * c, y: fit.box.y - (fit.at.y + oy) * c };
  const after = zoomed(corner, pivot, k);
  return { x: after.x, y: after.y, scale: k * c };
}

/**
 * How long the page takes to settle from where the dive left it to where the reader has it, in
 * milliseconds: longer for a longer way.
 */
export function settleMs(distance: number): number {
  return Math.round(Math.min(1250, Math.max(650, 650 + distance * 0.35)));
}

/**
 * The colour of the wipe for a comic: the hue of its cover, made loud. A cover's average colour is
 * often a dull one, and a flat cover of it on the screen would look muddy.
 */
export function vividColour(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return "#ff5a7a";
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => Number.parseInt(v ?? "0", 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  const l0 = (max + min) / 2;
  const s0 = d === 0 ? 0 : d / (1 - Math.abs(2 * l0 - 1));
  // Loud, and in the middle of the lightness so that it neither washes out nor goes black.
  const s = Math.max(s0, 0.7);
  const l = Math.min(0.62, Math.max(0.52, l0));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const off = l - c / 2;
  const [r1, g1, b1] =
    h < 1
      ? [c, x, 0]
      : h < 2
        ? [x, c, 0]
        : h < 3
          ? [0, c, x]
          : h < 4
            ? [0, x, c]
            : h < 5
              ? [x, 0, c]
              : [c, 0, x];
  const part = (v: number) =>
    Math.round((v + off) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${part(r1)}${part(g1)}${part(b1)}`;
}
