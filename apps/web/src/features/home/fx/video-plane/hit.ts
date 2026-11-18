/**
 * Where the pointer is on a plane, and which part of the picture a plane shows. Pure, so the hit
 * test, the hover effects and the tests agree with what is drawn.
 */
import { clamp, qRotate, type V3 } from "../image-field/math";
import { cardQuad, pointInQuad, quadBounds } from "../image-field/project";
import type { Quad, Rect } from "../image-field/types";
import type { PlanePose, Vp } from "./types";

export type { Quad, Rect };

/** The four corners of a plane on the screen (CSS px from the top left). False when a corner is behind the camera. */
export function planeQuad(p: PlanePose, lens: number, vp: Vp, out: Quad): boolean {
  return cardQuad(p.x, p.y, p.z, p.q, p.w, p.h, lens, vp, out);
}

export function inQuad(quad: Quad, x: number, y: number, grow = 0): boolean {
  return pointInQuad(quad, x, y, grow);
}

export function boundsOf(quad: Quad, out: Rect): Rect {
  return quadBounds(quad, out);
}

const axisX: V3 = [0, 0, 0];
const axisY: V3 = [0, 0, 0];
const axisZ: V3 = [0, 0, 0];

/**
 * The pointer's place on a plane, as fractions of its width and height from its centre (x to the
 * right, y up, -0.5 to 0.5 on the plane): the ray from the camera (`lens` in front of the screen)
 * through the point meets the plane at one place. False when the ray never meets it.
 */
export function pointerOnPlane(
  px: number,
  py: number,
  p: PlanePose,
  lens: number,
  vp: Vp,
  out: [number, number],
): boolean {
  qRotate(p.q, 1, 0, 0, axisX);
  qRotate(p.q, 0, 1, 0, axisY);
  qRotate(p.q, 0, 0, 1, axisZ);
  // The ray from the camera C = (0, 0, lens) through the screen point on the plane z = 0.
  const dx = px - vp.w / 2;
  const dy = vp.h / 2 - py;
  const dz = -lens;
  const denom = axisZ[0] * dx + axisZ[1] * dy + axisZ[2] * dz;
  if (Math.abs(denom) < 1e-6) return false;
  const t = (axisZ[0] * p.x + axisZ[1] * p.y + axisZ[2] * (p.z - lens)) / denom;
  if (t <= 0) return false;
  const hx = dx * t - p.x;
  const hy = dy * t - p.y;
  const hz = dz * t + lens - p.z;
  out[0] = (hx * axisX[0] + hy * axisX[1] + hz * axisX[2]) / Math.max(1e-3, p.w);
  out[1] = (hx * axisY[0] + hy * axisY[1] + hz * axisY[2]) / Math.max(1e-3, p.h);
  return true;
}

/**
 * The window of the picture a plane shows, in fractions of the picture (y from the top). The
 * window is the cover of a frame of `winAspect` on the picture, centred on (`fx`, `fy`); a plane
 * wider than that frame shows a band of it (a reveal: the picture is never rescaled when a frame
 * opens), a taller one shows less of its width. `zoom` (at least 1) magnifies about the centre.
 *
 * Writes `out` = [centre x, centre y, width, height] and keeps the window inside the picture.
 */
export function contentWindow(
  planeAspect: number,
  winAspect: number,
  picAspect: number,
  fx: number,
  fy: number,
  zoom: number,
  shiftX: number,
  shiftY: number,
  out: [number, number, number, number],
): void {
  // The share of the picture a frame of `winAspect` covers.
  const sx = winAspect > picAspect ? 1 : winAspect / picAspect;
  const sy = winAspect > picAspect ? picAspect / winAspect : 1;
  let w: number;
  let h: number;
  if (planeAspect >= winAspect) {
    w = sx;
    h = (sy * winAspect) / planeAspect;
  } else {
    w = (sx * planeAspect) / winAspect;
    h = sy;
  }
  const z = Math.max(1, zoom);
  w /= z;
  h /= z;
  out[2] = w;
  out[3] = h;
  out[0] = clamp(fx + shiftX, w / 2, 1 - w / 2);
  out[1] = clamp(fy + shiftY, h / 2, 1 - h / 2);
}
