/**
 * Round seven's cameras: the ones fitted to the recording (`horizontal.mkv`), not the game's own.
 * `cameras-r7.json` (made by `scripts/home/models/cameras-r7/`) holds, for each clip, a key every
 * 1/30 s: position and quaternion in her own space (glTF, metres, the space of `cameras.json`), the
 * vertical field of view of the recording's own frame (2.222 wide) and the lens shift of that
 * frame. Pure maths: the actor turns the numbers into a camera.
 *
 * The frame of a key is the recording's: `vfov` degrees from its bottom edge to its top edge, the
 * optical axis `shy` of the frame's height below its middle (Blender's shift, so a positive shift
 * moves the picture down). A screen shows that frame by `fit`: the whole frame inside the screen
 * (contain) or the screen filled by it (cover). The portrait frame of the list covers.
 */
import type { Rect } from "./framing";

export const R7_STRIDE = 9;
/** Where the extras sit in a key: 0..2 position, 3..6 quaternion, then these. */
export const R7_VFOV = 7;
export const R7_SHY = 8;

export interface R7Clip {
  frames: number;
  duration: number;
  /** A loop's camera is static: one key. */
  static: boolean;
  /** Flat keys: px, py, pz, qx, qy, qz, qw, vfov, shy. */
  keys: number[];
}

export interface R7Data {
  fps: number;
  /** The recording's shape: 3840 by 1728. */
  aspect: number;
  clips: Record<string, R7Clip>;
  /**
   * The portrait camera (`vertical.mkv`), for the clips it differs in. A clip that is not here uses
   * the wide camera's key for the portrait lens too.
   */
  portrait?: Record<string, R7Clip>;
  /**
   * Where the skybox sits: the matrix (row major, 3 by 3) that takes a direction in her own space
   * to the direction the equirectangular picture is read in (`sky.ts`). One for the whole scene:
   * the sky is fixed to the world.
   */
  sky: { fromFilm: number[] };
}

/** One key of a clip, written into `out` (9 numbers). A clip that is not there gives the idle. */
export function sampleR7(
  data: R7Data,
  clip: string,
  t: number,
  out: ArrayLike<number> & Record<number, number>,
  table: "clips" | "portrait" = "clips",
): void {
  const c = (table === "portrait" ? data.portrait?.[clip] : undefined) ?? data.clips[clip];
  if (!c) throw new Error(`cameras-r7.json has no clip "${clip}"`);
  const n = Math.floor(c.keys.length / R7_STRIDE);
  if (n <= 1 || c.static) {
    for (let k = 0; k < R7_STRIDE; k += 1) out[k] = c.keys[k]!;
    return;
  }
  const f = Math.max(0, Math.min(n - 1, t * data.fps));
  const i = Math.min(n - 2, Math.floor(f));
  const w = f - i;
  const a = i * R7_STRIDE;
  const b = a + R7_STRIDE;
  for (let k = 0; k < 3; k += 1) out[k] = c.keys[a + k]! + (c.keys[b + k]! - c.keys[a + k]!) * w;
  for (let k = R7_VFOV; k < R7_STRIDE; k += 1) {
    out[k] = c.keys[a + k]! + (c.keys[b + k]! - c.keys[a + k]!) * w;
  }
  nlerp(c.keys, a + 3, b + 3, w, out, 3);
}

/** Shortest-path normalised lerp of two quaternions held in flat arrays (keys are 1/30 s apart). */
function nlerp(
  keys: ArrayLike<number>,
  a: number,
  b: number,
  w: number,
  out: Record<number, number>,
  o: number,
): void {
  let dot = 0;
  for (let k = 0; k < 4; k += 1) dot += keys[a + k]! * keys[b + k]!;
  const sign = dot < 0 ? -1 : 1;
  let len = 0;
  for (let k = 0; k < 4; k += 1) {
    const v = keys[a + k]! + (sign * keys[b + k]! - keys[a + k]!) * w;
    out[o + k] = v;
    len += v * v;
  }
  len = 1 / Math.sqrt(len);
  for (let k = 0; k < 4; k += 1) out[o + k] = out[o + k]! * len;
}

/** Two keys mixed (`w` 0 is `a`): the pose by a normalised lerp, the lens by a lerp. */
export function mixR7(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  w: number,
  out: ArrayLike<number> & Record<number, number>,
): void {
  for (let k = 0; k < 3; k += 1) out[k] = a[k]! + (b[k]! - a[k]!) * w;
  for (let k = R7_VFOV; k < R7_STRIDE; k += 1) out[k] = a[k]! + (b[k]! - a[k]!) * w;
  let dot = 0;
  for (let k = 3; k < 7; k += 1) dot += a[k]! * b[k]!;
  const sign = dot < 0 ? -1 : 1;
  let len = 0;
  for (let k = 3; k < 7; k += 1) {
    const v = a[k]! + (sign * b[k]! - a[k]!) * w;
    out[k] = v;
    len += v * v;
  }
  len = 1 / Math.sqrt(len);
  for (let k = 3; k < 7; k += 1) out[k] = out[k]! * len;
}

/** What `lensFor` writes: the arguments of `PerspectiveCamera` and `setViewOffset`. */
export interface R7Lens {
  fov: number;
  aspect: number;
  fullWidth: number;
  fullHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The lens in pixels: the focal length and the optical axis (CSS pixels, top left origin). */
  focal: number;
  cx: number;
  cy: number;
}

export function newLens(): R7Lens {
  return {
    fov: 50,
    aspect: 1,
    fullWidth: 1,
    fullHeight: 1,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    focal: 1,
    cx: 0,
    cy: 0,
  };
}

/**
 * The size, in pixels, the recording's frame takes when it is shown in `rect`: `cover` 0 puts the
 * whole frame inside the rectangle, 1 makes the frame fill it (the sides or the top and bottom are
 * cut), a value between mixes the two.
 */
export function frameHeight(rect: Rect, aspect: number, cover: number): number {
  const contain = Math.min(rect.h, rect.w / aspect);
  const fill = Math.max(rect.h, rect.w / aspect);
  return contain + (fill - contain) * cover;
}

/**
 * The lens of a key shown in `rect` of a canvas `w` by `h` (CSS pixels): the focal length that
 * makes the frame's height `frameHeight`, the optical axis at the rectangle's middle moved down by
 * `shy` of that height. Written as a field of view and a view offset of the whole canvas.
 */
export function lensFor(
  rect: Rect,
  canvas: { w: number; h: number },
  vfovDeg: number,
  shy: number,
  aspect: number,
  cover: number,
  out: R7Lens = newLens(),
): R7Lens {
  const fh = frameHeight(rect, aspect, cover);
  const focal = fh / (2 * Math.tan((vfovDeg * Math.PI) / 360));
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2 + shy * fh;
  return lensFromPixels(canvas, focal, cx, cy, out);
}

/** A lens from its pixel numbers: the focal length and where the optical axis meets the canvas. */
export function lensFromPixels(
  canvas: { w: number; h: number },
  focal: number,
  cx: number,
  cy: number,
  out: R7Lens = newLens(),
): R7Lens {
  const fullWidth = 2 * Math.max(cx, canvas.w - cx);
  const fullHeight = 2 * Math.max(cy, canvas.h - cy);
  out.focal = focal;
  out.cx = cx;
  out.cy = cy;
  out.fov = (2 * Math.atan(fullHeight / (2 * focal)) * 180) / Math.PI;
  out.aspect = fullWidth / fullHeight;
  out.fullWidth = fullWidth;
  out.fullHeight = fullHeight;
  out.x = fullWidth / 2 - cx;
  out.y = fullHeight / 2 - cy;
  out.width = canvas.w;
  out.height = canvas.h;
  return out;
}

/** The two lenses mixed in pixels (`k` 0 is `a`), the way `camera-blend.ts` mixes the older ones. */
export function mixLens(
  canvas: { w: number; h: number },
  a: R7Lens,
  b: R7Lens,
  k: number,
  out: R7Lens = newLens(),
): R7Lens {
  return lensFromPixels(
    canvas,
    a.focal + (b.focal - a.focal) * k,
    a.cx + (b.cx - a.cx) * k,
    a.cy + (b.cy - a.cy) * k,
    out,
  );
}

/** The cursor's turn of the whole model, in degrees at the screen's edge. */
export const VIEW_TURN = { yawDeg: 4, pitchDeg: 2 } as const;

/**
 * Turn the camera about a pivot, as if the model in front of it turned the other way: `yaw` about
 * the world's up axis (Y, in her own space), then `pitch` about the camera's own right axis, both
 * through `pivot`. The position is written to `pos` (3) and the rotation is multiplied into `quat`
 * (4, x y z w). Radians. Allocates nothing.
 */
export function orbitAbout(
  pivot: ArrayLike<number>,
  yaw: number,
  pitch: number,
  pos: Record<number, number>,
  quat: Record<number, number>,
): void {
  // Yaw: p' = pivot + Ry(yaw) (p - pivot); q' = Ry(yaw) q.
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  let dx = pos[0]! - pivot[0]!;
  const dy = pos[1]! - pivot[1]!;
  let dz = pos[2]! - pivot[2]!;
  const px = cy * dx + sy * dz;
  const pz = -sy * dx + cy * dz;
  dx = px;
  dz = pz;
  const hy = Math.sin(yaw / 2);
  const hw = Math.cos(yaw / 2);
  let x = quat[0]!;
  let y = quat[1]!;
  let z = quat[2]!;
  let w = quat[3]!;
  // Ry(yaw) as (0, hy, 0, hw) times q.
  let qx = hw * x + hy * z;
  let qy = hw * y + hy * w;
  let qz = hw * z - hy * x;
  let qw = hw * w - hy * y;
  // Pitch about the camera's right axis: the rotation axis in the world is q * (1, 0, 0).
  const ax = 1 - 2 * (qy * qy + qz * qz);
  const ay = 2 * (qx * qy + qw * qz);
  const az = 2 * (qx * qz - qw * qy);
  const sp = Math.sin(pitch / 2);
  const rw = Math.cos(pitch / 2);
  const rx = ax * sp;
  const ry = ay * sp;
  const rz = az * sp;
  // The position turned by the pitch rotation (rx, ry, rz, rw) about the pivot.
  rotateBy(rx, ry, rz, rw, dx, dy, dz, pos);
  pos[0] = pivot[0]! + pos[0]!;
  pos[1] = pivot[1]! + pos[1]!;
  pos[2] = pivot[2]! + pos[2]!;
  // q'' = Rpitch q'.
  x = rw * qx + rx * qw + ry * qz - rz * qy;
  y = rw * qy - rx * qz + ry * qw + rz * qx;
  z = rw * qz + rx * qy - ry * qx + rz * qw;
  w = rw * qw - rx * qx - ry * qy - rz * qz;
  qx = x;
  qy = y;
  qz = z;
  qw = w;
  const len = 1 / Math.hypot(qx, qy, qz, qw);
  quat[0] = qx * len;
  quat[1] = qy * len;
  quat[2] = qz * len;
  quat[3] = qw * len;
}

/** A vector rotated by a unit quaternion (x y z w), written to `out` 0..2. */
function rotateBy(
  qx: number,
  qy: number,
  qz: number,
  qw: number,
  vx: number,
  vy: number,
  vz: number,
  out: Record<number, number>,
): void {
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  out[0] = vx + qw * tx + (qy * tz - qz * ty);
  out[1] = vy + qw * ty + (qz * tx - qx * tz);
  out[2] = vz + qw * tz + (qx * ty - qy * tx);
}
