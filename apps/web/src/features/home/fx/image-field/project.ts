/**
 * Where a card is on the screen. One pure function serves the hit test, `slotRect` and the tests,
 * so what the pointer finds is what is drawn. The camera sits `d` in front of the picture plane
 * and looks at the middle of it; a point at z = 0 lands exactly where it says, whatever `d` is
 * (the telephoto look of the wall is a larger `d`, see `pixelFov` in the kernel's stage).
 */
import { qRotate, type Q, type V3 } from "./math";
import type { Quad, Rect, Vp } from "./types";

/** The camera distance at which one unit is one pixel at z = 0 (the kernel's `PIXEL_DISTANCE`). */
export const BASE_DISTANCE = 1000;

const scratch: V3 = [0, 0, 0];

/**
 * Project a point of the stage frame to CSS pixels from the top left of the viewport. Returns
 * false for a point at or behind the camera.
 */
export function project(
  x: number,
  y: number,
  z: number,
  d: number,
  vp: Vp,
  out: [number, number],
): boolean {
  const k = d - z;
  if (k <= 1) return false;
  const s = d / k;
  out[0] = vp.w / 2 + x * s;
  out[1] = vp.h / 2 - y * s;
  return true;
}

const corner: [number, number] = [0, 0];

/**
 * The quad of a flat card: centre (x, y, z), rotation `q`, size `w` by `h`. Corners run top left,
 * top right, bottom right, bottom left of the card as it faces the camera. Returns false when a
 * corner is behind the camera (the card is not hit and has no rectangle).
 */
export function cardQuad(
  x: number,
  y: number,
  z: number,
  q: Q,
  w: number,
  h: number,
  d: number,
  vp: Vp,
  out: Quad,
): boolean {
  const hw = w / 2;
  const hh = h / 2;
  for (let c = 0; c < 4; c++) {
    const lx = c === 0 || c === 3 ? -hw : hw;
    const ly = c < 2 ? hh : -hh;
    qRotate(q, lx, ly, 0, scratch);
    if (!project(x + scratch[0], y + scratch[1], z + scratch[2], d, vp, corner)) return false;
    out[c * 2] = corner[0];
    out[c * 2 + 1] = corner[1];
  }
  return true;
}

/** Whether a point is inside a convex quad (either winding), the quad grown by `grow` pixels. */
export function pointInQuad(quad: Quad, px: number, py: number, grow = 0): boolean {
  return insideConvex(quad, px, py, grow);
}

/** The convex test: all edge distances have one sign (a point within `grow` of an edge counts). */
function insideConvex(quad: Quad, px: number, py: number, grow: number): boolean {
  let allPos = true;
  let allNeg = true;
  for (let i = 0; i < 4; i++) {
    const ax = quad[i * 2]!;
    const ay = quad[i * 2 + 1]!;
    const j = (i + 1) % 4;
    const bx = quad[j * 2]!;
    const by = quad[j * 2 + 1]!;
    const ex = bx - ax;
    const ey = by - ay;
    const len = Math.hypot(ex, ey) || 1;
    const cross = (ex * (py - ay) - ey * (px - ax)) / len;
    if (cross < -grow) allPos = false;
    if (cross > grow) allNeg = false;
  }
  return allPos || allNeg;
}

/** The smallest rectangle that holds a quad. */
export function quadBounds(quad: Quad, out: Rect): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < 4; i++) {
    const x = quad[i * 2]!;
    const y = quad[i * 2 + 1]!;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  out.x = x0;
  out.y = y0;
  out.w = x1 - x0;
  out.h = y1 - y0;
  return out;
}
