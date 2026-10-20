/**
 * The maths of the image viewer: zoom and pan, kept apart from the component so it can be tested.
 *
 * An image is drawn at its natural size, centred in the stage, and moved and scaled with one
 * transform. `z` is the zoom relative to "fit" (1 shows the whole image), and `x` and `y` move the
 * image from the centre, in CSS pixels. The scale on screen is `fitScale * z`, so a scale of 1 is
 * the natural size of the picture (100 percent).
 */
export interface Box {
  /** The stage, in CSS pixels. */
  cw: number;
  ch: number;
  /** The image at its natural size. */
  iw: number;
  ih: number;
}

export interface View {
  z: number;
  x: number;
  y: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** The scale that shows the whole image. A small image is not stretched beyond its natural size. */
export function fitScale(b: Box): number {
  if (b.iw <= 0 || b.ih <= 0 || b.cw <= 0 || b.ch <= 0) return 1;
  return Math.min(1, b.cw / b.iw, b.ch / b.ih);
}

/** The zoom at which the image is at its natural size (100 percent). At least 1. */
export function naturalZoom(b: Box): number {
  return Math.max(1, 1 / fitScale(b));
}

/** The most the image can be zoomed: four times fit, and at least three times the natural size. */
export function maxZoom(b: Box): number {
  return Math.max(4, 3 / fitScale(b));
}

export const clampZoom = (z: number, b: Box): number => clamp(z, 1, maxZoom(b));

/** Keep the image on the stage: it can be moved only as far as its edges allow, and a picture
 * smaller than the stage stays in the middle. */
export function clampPan(x: number, y: number, z: number, b: Box): [number, number] {
  const s = fitScale(b) * z;
  const ex = Math.max(0, (b.iw * s - b.cw) / 2);
  const ey = Math.max(0, (b.ih * s - b.ch) / 2);
  // `+ 0` turns a negative zero into a plain zero.
  return [clamp(x, -ex, ex) + 0, clamp(y, -ey, ey) + 0];
}

/**
 * Zoom to `z` keeping the point of the image under the pointer where it is. `px` and `py` are the
 * pointer's place relative to the centre of the stage.
 */
export function zoomAround(view: View, z: number, px: number, py: number, b: Box): View {
  const next = clampZoom(z, b);
  const ratio = next / view.z;
  const [x, y] = clampPan(px - (px - view.x) * ratio, py - (py - view.y) * ratio, next, b);
  return { z: next, x, y };
}

/** The zoom a wheel turn asks for. A trackpad pinch (`ctrl`) sends smaller steps. */
export function wheelZoom(z: number, deltaY: number, ctrl: boolean): number {
  return z * Math.exp(-deltaY * (ctrl ? 0.01 : 0.0016));
}

/** The label for a zoom: the scale on screen as a percentage of the natural size. */
export function zoomPercent(z: number, b: Box): number {
  return Math.round(fitScale(b) * z * 100);
}
