/**
 * The baked camera of `city_intercation03` (`cameras.json`, made by scripts/home/models/): a key
 * every 1/30 s, position and quaternion in the model's own space, a vertical field of view of
 * 61.9275 degrees for a 16:9 frame, of which the recording shows the bottom 80 percent. Pure maths:
 * the file is read by the actor, the numbers become a camera there.
 */
import { BAKED } from "./constants";

interface CameraClip {
  frames: number;
  duration: number;
  static: boolean;
  stride: number;
  /** Flat keys: px, py, pz, qx, qy, qz, qw. */
  keys: number[];
}

export interface CameraData {
  fps: number;
  vfovDeg: number;
  clips: Record<string, CameraClip>;
}

/** The baked pose at a time: position (0..2) and quaternion (3..6), written into `out`. */
export function sampleBakedCamera(
  data: CameraData,
  clip: string,
  t: number,
  out: ArrayLike<number> & Record<number, number>,
): void {
  const c = data.clips[clip];
  if (!c) throw new Error(`cameras.json has no clip "${clip}"`);
  const stride = c.stride;
  const n = Math.floor(c.keys.length / stride);
  if (n <= 1 || c.static) {
    for (let k = 0; k < 7; k += 1) out[k] = c.keys[k]!;
    return;
  }
  const f = Math.max(0, Math.min(n - 1, t * data.fps));
  const i = Math.min(n - 2, Math.floor(f));
  const w = f - i;
  const a = i * stride;
  const b = a + stride;
  for (let k = 0; k < 3; k += 1) {
    const from = c.keys[a + k]!;
    out[k] = from + (c.keys[b + k]! - from) * w;
  }
  // Quaternion: shortest path, then slerp (or a normalised lerp when nearly equal).
  let dot = 0;
  for (let k = 3; k < 7; k += 1) dot += c.keys[a + k]! * c.keys[b + k]!;
  const sign = dot < 0 ? -1 : 1;
  dot *= sign;
  let s0 = 1 - w;
  let s1 = w;
  if (dot < 0.9995) {
    const theta = Math.acos(dot);
    const sin = Math.sin(theta);
    s0 = Math.sin((1 - w) * theta) / sin;
    s1 = Math.sin(w * theta) / sin;
  }
  let len = 0;
  for (let k = 3; k < 7; k += 1) {
    const v = s0 * c.keys[a + k]! + s1 * sign * c.keys[b + k]!;
    out[k] = v;
    len += v * v;
  }
  len = 1 / Math.sqrt(len);
  for (let k = 3; k < 7; k += 1) out[k] = out[k]! * len;
}

/**
 * The keys of every moving clip, smoothed by a Gaussian `sigma` keys wide (the owner, 26 Nov 2026:
 * every move of the home blends, the camera too). The recording's camera was keyed with straight
 * tangents, so its speed changes from one key to the next (0.8 to 2.5 cm and 1.7 to 7.3 degrees a
 * key on the way out) and its turn shivers by a few tenths of a degree at rest. Smoothed by two
 * keys it eases into and out of every change: the hand-over and the bite move by under half a
 * centimetre and half a degree, the fast turn at half a second lags by under four degrees. The
 * window narrows at both ends, so the first and the last key stay where they are.
 */
export function smoothCameras(data: CameraData, sigma: number): CameraData {
  const clips: Record<string, CameraClip> = {};
  for (const [name, c] of Object.entries(data.clips)) {
    clips[name] = c.static || sigma <= 0 ? c : { ...c, keys: smoothKeys(c.keys, c.stride, sigma) };
  }
  return { ...data, clips };
}

function smoothKeys(keys: readonly number[], stride: number, sigma: number): number[] {
  const n = Math.floor(keys.length / stride);
  const out = keys.slice();
  const reach = Math.ceil(sigma * 2.5);
  const acc = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < n; i += 1) {
    const at = i * stride;
    const r = Math.min(reach, i, n - 1 - i);
    acc.fill(0);
    let total = 0;
    for (let j = -r; j <= r; j += 1) {
      const w = Math.exp(-(j * j) / (2 * sigma * sigma));
      const b = (i + j) * stride;
      // The same rotation has two quaternions: take the one on the side of this key's.
      let dot = 0;
      for (let k = 3; k < 7; k += 1) dot += keys[at + k]! * keys[b + k]!;
      const sign = dot < 0 ? -w : w;
      for (let k = 0; k < 3; k += 1) acc[k] = acc[k]! + w * keys[b + k]!;
      for (let k = 3; k < 7; k += 1) acc[k] = acc[k]! + sign * keys[b + k]!;
      total += w;
    }
    for (let k = 0; k < 3; k += 1) out[at + k] = acc[k]! / total;
    const len = Math.hypot(acc[3]!, acc[4]!, acc[5]!, acc[6]!);
    for (let k = 3; k < 7; k += 1) out[at + k] = acc[k]! / len;
  }
  return out;
}

export interface FrameOptions {
  /** The share of the baked frame's height that the screen shows, from its bottom. Default 0.8. */
  band?: number;
  /**
   * "height" (default) keeps the baked vertical field of view: the notes' formula, an exact match
   * with the recording at its own shape. "width" keeps the horizontal extent of the 16:9 recording
   * as far as `maxFov` allows, so a narrower screen sees a wider lens instead of losing the sides.
   */
  fit?: "height" | "width";
  /** The widest vertical field of view, in degrees, that "width" may use. Default 80. */
  maxFov?: number;
}

export interface FrameSpec {
  /** Vertical field of view of the whole baked frame, in degrees. */
  fov: number;
  /** Aspect of the whole baked frame (`camera.aspect`). */
  aspect: number;
  /** The arguments of `camera.setViewOffset`: the screen is a window on the whole frame. */
  view: {
    fullWidth: number;
    fullHeight: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * A screen of `w` by `h` as a window on the baked frame. At the recording's own shape (2.222) and
 * `band` 0.8 this is the notes' formula: aspect = w / (1.25 h), setViewOffset(w, 1.25 h, 0, 0.25 h, w, h).
 */
export function frameCamera(w: number, h: number, options: FrameOptions = {}): FrameSpec {
  const band = options.band ?? BAKED.band;
  const fullHeight = h / band;
  const aspect = w / fullHeight;
  let fov: number = BAKED.vfovDeg;
  if (options.fit === "width") {
    const halfTan = Math.tan((BAKED.vfovDeg * Math.PI) / 360) * BAKED.aspect;
    const wanted = (2 * Math.atan(halfTan / aspect) * 180) / Math.PI;
    fov = Math.max(BAKED.vfovDeg, Math.min(options.maxFov ?? 80, wanted));
  }
  return {
    fov,
    aspect,
    view: { fullWidth: w, fullHeight, x: 0, y: fullHeight - h, width: w, height: h },
  };
}

/** The doll's hover point over her right hand for a clip time (model space offsets). */
export function dollOffset(
  t: number,
  anchor: {
    hover: readonly number[];
    drift: readonly number[];
    hold: number;
    driftTo: number;
  },
  out: number[],
): void {
  const span = anchor.driftTo - anchor.hold;
  const x =
    span > 0 ? Math.max(0, Math.min(1, (t - anchor.hold) / span)) : t >= anchor.hold ? 1 : 0;
  const w = x * x * (3 - 2 * x);
  for (let k = 0; k < 3; k += 1) {
    const from = anchor.hover[k]!;
    out[k] = from + (anchor.drift[k]! - from) * w;
  }
}
