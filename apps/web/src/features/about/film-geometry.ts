import { HOLD_SCREENS, MORPH_SCREENS, REEL_ASPECT } from "./layout";

/**
 * Where the reel's picture is on the screen for a given scroll. Pure arithmetic, shared by the
 * film (which draws it) and the drone (which flies behind it and must stay in view), and tested.
 * All boxes are in CSS pixels of the viewport.
 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** A slow start and a soft landing: the picture leaves its slot gently and settles into the window. */
function morphEase(t: number): number {
  const v = clamp01(t);
  return v * v * v * (v * (v * 6 - 15) + 10);
}

/** 0 at the top of the page, 1 when the big window is complete. */
export function morphProgress(scrollY: number, vh: number): number {
  return clamp01(scrollY / (MORPH_SCREENS * vh));
}

/** The scroll at which the big window is complete, and the scroll at which it starts to leave. */
export function morphEnd(vh: number): number {
  return MORPH_SCREENS * vh;
}
export function holdEnd(vh: number): number {
  return (MORPH_SCREENS + HOLD_SCREENS) * vh;
}

/**
 * The big window at rest: as wide as the page between the gutters, in the reel's own shape, in the
 * middle of the space under the bar. On a short, wide screen its height is held to that space less
 * a margin above (the drone perches there) and below, and it narrows to keep its shape.
 */
export function windowBox(vw: number, vh: number, navH: number, gutter: number): Box {
  const room = vh - navH;
  const maxH = Math.max(120, room - Math.max(150, room * 0.3));
  let w = vw - 2 * gutter;
  let h = w / REEL_ASPECT;
  if (h > maxH) {
    h = maxH;
    w = h * REEL_ASPECT;
  }
  const spare = room - h;
  return { x: (vw - w) / 2, y: navH + spare * 0.56, w, h };
}

/**
 * The picture's box at this scroll. `slot` is the preview's place on the first screen as it is at
 * the top of the page; it rides up with the page. `win` is the big window at rest. During the
 * morph the picture travels from the one to the other; then it stands for the hold; then it leaves
 * with the page.
 */
export function filmBox(slot: Box, win: Box, scrollY: number, vh: number): Box {
  const e = morphEase(morphProgress(scrollY, vh));
  const gone = Math.max(0, scrollY - holdEnd(vh));
  const w = mix(slot.w, win.w, e);
  return {
    x: mix(slot.x, win.x, e),
    y: mix(slot.y - scrollY, win.y, e) - gone,
    w,
    h: w / REEL_ASPECT,
  };
}

/** The small tilt of the picture on its way, in degrees: none at both ends. */
export function morphTilt(scrollY: number, vh: number): number {
  const p = morphProgress(scrollY, vh);
  return -2.2 * Math.sin(Math.PI * p) * Math.sin(Math.PI * p);
}

/**
 * How much of a round thing (the drone, as a circle of this centre and radius) is not behind a box.
 * 1 is all of it, 0 none. A coarse grid is enough: this is used to keep the drone in view.
 */
export function uncovered(cx: number, cy: number, r: number, box: Box): number {
  const n = 12;
  let inside = 0;
  let hidden = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const px = cx - r + ((i + 0.5) / n) * 2 * r;
      const py = cy - r + ((j + 0.5) / n) * 2 * r;
      if ((px - cx) ** 2 + (py - cy) ** 2 > r * r) continue;
      inside += 1;
      if (px >= box.x && px <= box.x + box.w && py >= box.y && py <= box.y + box.h) hidden += 1;
    }
  }
  return inside === 0 ? 1 : 1 - hidden / inside;
}
