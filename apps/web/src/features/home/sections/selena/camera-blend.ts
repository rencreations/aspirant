/**
 * The lens between two views of the one stage: the pixel camera (one unit is one screen pixel at the
 * middle plane, the whole screen is the frame) and the baked camera of the film (a 16:9 frame of which
 * the screen is the bottom window). Pure arithmetic on the numbers of the two lenses: the focal
 * length in pixels and the height of the whole frame are mixed, and the field of view and the view
 * offset follow from them, so at 0 the picture is the pixel view and at 1 it is the baked one.
 */

/** What the baked camera says about its lens (`PerspectiveCamera` after `setViewOffset`). */
export interface BakedLens {
  /** Vertical field of view of the whole frame, in degrees. */
  fov: number;
  /** The height of the whole frame, in pixels, when the screen is `h` tall. */
  fullHeight: number;
  /** How far the screen's window is from the top of the whole frame, in pixels. */
  offsetY: number;
}

/** The lens to give the camera: `fov` and `aspect` for the whole frame, `offsetY` for the window. */
export interface Lens {
  fov: number;
  aspect: number;
  fullHeight: number;
  offsetY: number;
}

const RAD = Math.PI / 180;

export function newLens(): Lens {
  return { fov: 48, aspect: 1, fullHeight: 1, offsetY: 0 };
}

/** The pixel camera's field of view for a screen `h` tall and a camera `distance` away. */
export function pixelFov(h: number, distance: number): number {
  return (2 * Math.atan(h / 2 / distance)) / RAD;
}

/**
 * The lens for a screen of `w` by `h` at `k` (0 the pixel view, 1 the baked one). The focal length
 * in pixels and the frame's height are mixed linearly.
 */
export function blendLens(
  w: number,
  h: number,
  pixel: number,
  baked: BakedLens,
  k: number,
  out: Lens = newLens(),
): Lens {
  const focalA = h / (2 * Math.tan((pixel * RAD) / 2));
  const focalB = baked.fullHeight / (2 * Math.tan((baked.fov * RAD) / 2));
  const fullHeight = h + (baked.fullHeight - h) * k;
  const focal = focalA + (focalB - focalA) * k;
  out.fullHeight = fullHeight;
  out.fov = (2 * Math.atan(fullHeight / (2 * focal))) / RAD;
  out.aspect = w / fullHeight;
  out.offsetY = baked.offsetY * k;
  return out;
}

/**
 * How far along its way the camera is when the swing is at `k` (0 to 1 both ways). A power above 1
 * keeps it out at first and brings it in fast at the end.
 */
export function travelOf(k: number, power: number): number {
  const x = k <= 0 ? 0 : k >= 1 ? 1 : k;
  return Math.pow(x, power);
}

/**
 * How far the camera is drawn back along its view axis at `k`, as a share of its distance in the
 * pixel view. Zero at both ends, so the swing starts and ends on the two views exactly.
 */
export function pullOf(k: number, amount: number): number {
  const x = k <= 0 ? 0 : k >= 1 ? 1 : k;
  return amount * Math.sin(Math.PI * x);
}
