import { filmBox, holdEnd, morphProgress, morphTilt, type Box } from "../film-geometry";

/**
 * The arithmetic of the first screen and the film: where the picture's wrapper goes for a scroll,
 * where the drone perches on the big window, how the tint and the copy fade, and how the bands of
 * the title trail the drone. Pure, so it is tested without a browser.
 */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/* ---- the picture ---- */

/** One transform of the wrapper, whose own box is the big window and whose origin is its top left. */
export interface Placement {
  x: number;
  y: number;
  scale: number;
  /** Degrees. The picture turns about its own middle, so `x` and `y` already carry the offset. */
  tilt: number;
}

/**
 * The transform that draws a wrapper laid out on `win` over `box`, turned by `tilt` degrees about
 * the middle of the picture. `box` and `win` are in the same coordinates.
 */
export function placementOf(box: Box, win: Box, tilt: number): Placement {
  const scale = box.w / win.w;
  const a = (tilt * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const hw = win.w / 2;
  const hh = win.h / 2;
  // A turn about the top left moves the middle: this takes the middle back to where it was.
  const backX = scale * (hw - (cos * hw - sin * hh));
  const backY = scale * (hh - (sin * hw + cos * hh));
  return { x: box.x - win.x + backX, y: box.y - win.y + backY, scale, tilt };
}

/** The picture for a scroll: its box in the viewport, and the transform inside the sticky stage. */
export function pictureAt(
  slot: Box,
  win: Box,
  scrollY: number,
  vh: number,
): { box: Box; place: Placement } {
  const box = filmBox(slot, win, scrollY, vh);
  // After the hold the stage itself leaves with the page, so the picture does not move inside it.
  const gone = Math.max(0, scrollY - holdEnd(vh));
  const inStage = { ...box, y: box.y + gone };
  return { box, place: placementOf(inStage, win, morphTilt(scrollY, vh)) };
}

/** The placement as a CSS transform. At rest in the window it is none at all. */
export function placementCss(p: Placement): string {
  const turned = Math.abs(p.tilt) >= 0.005;
  if (Math.abs(p.x) < 0.01 && Math.abs(p.y) < 0.01 && Math.abs(p.scale - 1) < 0.0001 && !turned)
    return "none";
  const turn = turned ? ` rotate(${p.tilt.toFixed(3)}deg)` : "";
  return `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0) scale(${p.scale.toFixed(5)})${turn}`;
}

/** The veil of paper over the preview: full at the top of the page, gone by 60 percent. */
export const TINT = 0.7;
export function tintAt(scrollY: number, vh: number): number {
  return TINT * (1 - smooth(0.04, 0.6, morphProgress(scrollY, vh)));
}

/** The small tag on the preview goes first: it belongs to the preview, not to the window. */
export function tagAt(scrollY: number, vh: number): number {
  return 1 - smooth(0.02, 0.16, morphProgress(scrollY, vh));
}

/**
 * The first screen's text as the page leaves. It bows out as the picture starts to grow, so the
 * picture never grows over half read lines, and nothing of it is left standing under the bare top
 * bar while the window holds.
 */
export function copyAt(scrollY: number, vh: number): number {
  return 1 - smooth(0.1, 0.46, morphProgress(scrollY, vh));
}

/* ---- the perch ---- */

/** The drone on the window: its width, how far in from the right end, how far above the edge. */
export const PERCH = { min: 84, vw: 9, max: 150, inset: 1.05, lift: 0.1 } as const;

function perchSize(vw: number): number {
  return Math.min(PERCH.max, Math.max(PERCH.min, (PERCH.vw / 100) * vw));
}

/**
 * The perch anchor: a square whose middle is the drone's middle. It sits over the top edge of the
 * big window near its right end, a little above the edge, so about a third of the drone is behind
 * the window.
 */
export function perchBox(win: Box, vw: number): Box {
  const s = perchSize(vw);
  const cx = win.x + win.w - s * PERCH.inset;
  const cy = win.y - s * PERCH.lift;
  return { x: cx - s / 2, y: cy - s / 2, w: s, h: s };
}

/* ---- the bands of the title ---- */

/** The rows the title is cut into for its reveal. */
export const BANDS = 8;

/** How far each band trails the drone at most, as a share of the title's width. */
const LAG = [0.02, 0.115, 0.05, 0.15, 0.03, 0.095, 0.135, 0.065] as const;

/**
 * Where band `i` has opened to, as a viewport x, when the drone is at `x`. Everything right of it
 * shows. `left` and `width` are the title's own. Each band trails the drone by its own length,
 * which breathes as the drone goes, so the edge is a comb of streaks. The comb closes as the
 * drone reaches the left end: at the end of the pass every band is open.
 */
export function bandEdge(i: number, x: number, left: number, width: number): number {
  const u = clamp01((x - left) / Math.max(1, width));
  const base = LAG[i % LAG.length] ?? 0;
  const breathe = 0.72 + 0.28 * Math.sin(2 * Math.PI * (1.4 * u + i * 0.37));
  return x + base * breathe * smooth(0, 0.22, u) * width;
}

/**
 * How strong the mark on a band's edge is when the drone is at `x`: whole over the title, and
 * gone as the drone reaches the left end, so no mark is left standing when the title is whole.
 */
export function tickAt(x: number, left: number, width: number): number {
  return smooth(0, 0.14, (x - left) / Math.max(1, width));
}
