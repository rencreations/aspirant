/**
 * Clip sampling without the animation mixer. A clip is a list of tracks (one bone, one channel,
 * keys at uneven times: the build resampled them and collapsed the constant ones). A pose is one
 * flat array, ten numbers a bone: position (3), quaternion (4), scale (3). Sampling a clip at a
 * time is a pure function, so a section can scrub it, and two poses blend by a weight.
 *
 * Every bone is in every pose: the pose starts as the rest pose, so a bone that a clip does not
 * key stays at rest, never at what an earlier frame left on it.
 */
export const POSE_STRIDE = 10;

export type Channel = "p" | "q" | "s";

export interface ClipTrack {
  /** Index into the skeleton's bone list. */
  bone: number;
  channel: Channel;
  times: ArrayLike<number>;
  values: ArrayLike<number>;
  /** The last segment found: the next lookup starts here (time moves a little each frame). */
  hint: number;
}

export interface ClipData {
  readonly name: string;
  readonly duration: number;
  readonly loop: boolean;
  readonly tracks: ClipTrack[];
}

const OFFSET: Record<Channel, number> = { p: 0, q: 3, s: 7 };

/** The index i with times[i] <= t <= times[i + 1] (n >= 2), searching from `hint`. */
export function findSegment(times: ArrayLike<number>, t: number, hint: number): number {
  const last = times.length - 2;
  let i = hint < 0 ? 0 : hint > last ? last : hint;
  while (i < last && t >= times[i + 1]!) i += 1;
  while (i > 0 && t < times[i]!) i -= 1;
  return i;
}

/** A time inside a clip: loops wrap, other clips hold their first and last key. */
export function clipTime(t: number, duration: number, loop: boolean): number {
  if (!(duration > 0)) return 0;
  if (loop) {
    const w = t - Math.floor(t / duration) * duration;
    return w >= duration ? 0 : w;
  }
  return t < 0 ? 0 : t > duration ? duration : t;
}

/** Shortest-path slerp of two quaternions held in arrays, written to `out` at `o`. */
export function slerpInto(
  a: ArrayLike<number>,
  ia: number,
  b: ArrayLike<number>,
  ib: number,
  f: number,
  out: Float32Array,
  o: number,
): void {
  const ax = a[ia]!;
  const ay = a[ia + 1]!;
  const az = a[ia + 2]!;
  const aw = a[ia + 3]!;
  let bx = b[ib]!;
  let by = b[ib + 1]!;
  let bz = b[ib + 2]!;
  let bw = b[ib + 3]!;
  let dot = ax * bx + ay * by + az * bz + aw * bw;
  if (dot < 0) {
    dot = -dot;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  let s0: number;
  let s1: number;
  if (dot > 0.9995) {
    s0 = 1 - f;
    s1 = f;
  } else {
    const theta = Math.acos(dot);
    const sin = Math.sin(theta);
    s0 = Math.sin((1 - f) * theta) / sin;
    s1 = Math.sin(f * theta) / sin;
  }
  const x = s0 * ax + s1 * bx;
  const y = s0 * ay + s1 * by;
  const z = s0 * az + s1 * bz;
  const w = s0 * aw + s1 * bw;
  const n = 1 / Math.hypot(x, y, z, w);
  out[o] = x * n;
  out[o + 1] = y * n;
  out[o + 2] = z * n;
  out[o + 3] = w * n;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Write what a clip says at time `t` (already inside the clip) over `pose`. */
export function sampleClip(clip: ClipData, t: number, pose: Float32Array): void {
  for (const track of clip.tracks) {
    const o = track.bone * POSE_STRIDE + OFFSET[track.channel];
    const width = track.channel === "q" ? 4 : 3;
    const times = track.times;
    const values = track.values;
    if (times.length === 1) {
      for (let k = 0; k < width; k += 1) pose[o + k] = values[k]!;
      continue;
    }
    const i = findSegment(times, t, track.hint);
    track.hint = i;
    const t0 = times[i]!;
    const span = times[i + 1]! - t0;
    const f = span > 0 ? clamp01((t - t0) / span) : 0;
    if (track.channel === "q") {
      slerpInto(values, i * 4, values, (i + 1) * 4, f, pose, o);
    } else {
      const ia = i * 3;
      const ib = ia + 3;
      for (let k = 0; k < 3; k += 1) {
        const va = values[ia + k]!;
        pose[o + k] = va + (values[ib + k]! - va) * f;
      }
    }
  }
}

/** out = a blended toward b by w (0 gives a, 1 gives b). `out` may be `a`. */
export function blendPoses(a: Float32Array, b: Float32Array, w: number, out: Float32Array): void {
  const bones = a.length / POSE_STRIDE;
  for (let i = 0; i < bones; i += 1) {
    const o = i * POSE_STRIDE;
    for (let k = 0; k < 3; k += 1) {
      const pa = a[o + k]!;
      const sa = a[o + 7 + k]!;
      out[o + k] = pa + (b[o + k]! - pa) * w;
      out[o + 7 + k] = sa + (b[o + 7 + k]! - sa) * w;
    }
    slerpInto(a, o + 3, b, o + 3, w, out, o + 3);
  }
}

/**
 * Make a clip track out of raw keys. A track whose keys all agree becomes one key, so sampling it
 * is a copy.
 */
export function makeTrack(
  bone: number,
  channel: Channel,
  times: ArrayLike<number>,
  values: ArrayLike<number>,
): ClipTrack {
  const width = channel === "q" ? 4 : 3;
  let constant = true;
  for (let i = width; i < values.length && constant; i += 1) {
    if (Math.abs(values[i]! - values[i % width]!) > 1e-6) constant = false;
  }
  if (constant || times.length < 2) {
    return {
      bone,
      channel,
      times: Float32Array.of(0),
      values: Float32Array.from(Array.from(values).slice(0, width)),
      hint: 0,
    };
  }
  return { bone, channel, times, values, hint: 0 };
}
