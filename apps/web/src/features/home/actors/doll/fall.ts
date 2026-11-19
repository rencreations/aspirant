/**
 * The doll's fall, round four (20 Nov 2026): a loop that plays on its own clock, and the blends that
 * lead into and out of it. No three here beyond the flat pose arrays of `pose/math.ts`.
 *
 *  - `FallClip` is the loop fitted from the Mixamo clip `Falling.fbx` by
 *    `scripts/home/models/doll/fall/fit.py` (`public/models/home/doll-fall.json`): 135 keys at 30 fps,
 *    4.5 seconds, the first key following the last. The root's turn (she falls on her front, her face
 *    toward the camera) is in the clip. A section never moves it: the player advances with the frame's
 *    own dt, so the speed is the same whatever the scroll does.
 *  - `FallPlayer` is that clock plus the blend weight (0.25 s in and out).
 *  - `CATCH_WIDE` and `CATCH_LOW` are the two poses of the landing (arms thrown wide, then in with the
 *    knees bent), and `landPose` / `standPose` are the pure blends the actor uses: the landing goes from the
 *    fall pose captured when it starts, through the two, and the standing up goes from the last to the
 *    pose the section asks for.
 */
import { at, clamp } from "./motion";
import { BONE_COUNT, BONE_NAMES, blendPoseData, slerpFlat, type PoseData } from "./pose/math";
import type { PoseDef } from "./pose/poses";

/**
 * Where the fitted clip lives and what the loading list reads. The query is the version of the fit: the
 * browser saves the file (`cachedFetch`), so a file changed under the same address needs a new `v`.
 */
export const FALL_DATA_PATH = "/models/home/doll-fall.json?v=3";
/** The speed of the loop. It stays 1: nothing a visitor does may change it. */
export const FALL_SPEED = 1;
/** The blend of the loop in and out, in seconds (a full 0 to 1 step). */
export const FALL_BLEND_SECONDS = 0.25;
/** The landing (fall pose to the catch) and the standing up, in seconds, for the sections' clocks. */
export const LAND_SECONDS = 0.5;
export const STAND_SECONDS = 0.7;

export interface FallData {
  readonly version: number;
  readonly fps: number;
  readonly keys: number;
  readonly seconds: number;
  readonly bones: readonly string[];
  readonly q: readonly number[];
  readonly hips: readonly number[];
}

/** The fitted loop, flat: `q` is x, y, z, w for each bone of each key, `hips` is the root's position. */
export class FallClip {
  readonly keys: number;
  readonly fps: number;
  readonly seconds: number;
  private readonly q: Float32Array;
  private readonly hips: Float32Array;

  private constructor(data: FallData) {
    this.keys = data.keys;
    this.fps = data.fps;
    this.seconds = data.keys / data.fps;
    this.q = Float32Array.from(data.q);
    this.hips = Float32Array.from(data.hips);
  }

  /** Check the file against the rig and make the clip, or null when it does not fit (a stale file). */
  static parse(raw: unknown): FallClip | null {
    const d = raw as Partial<FallData> | null;
    if (!d || typeof d !== "object") return null;
    const { keys, fps, bones, q, hips } = d;
    if (typeof keys !== "number" || typeof fps !== "number" || !bones || !q || !hips) return null;
    if (keys < 2 || fps <= 0) return null;
    if (bones.length !== BONE_COUNT || bones.some((n, i) => n !== BONE_NAMES[i])) return null;
    if (q.length !== keys * BONE_COUNT * 4 || hips.length !== keys * 3) return null;
    return new FallClip(d as FallData);
  }

  /** The pose at `seconds` of the loop (any real number, it wraps), into `out`. Scales are left alone. */
  sample(seconds: number, out: PoseData): void {
    const cycle = seconds / this.seconds;
    const k = (cycle - Math.floor(cycle)) * this.keys;
    const i0 = Math.min(this.keys - 1, Math.floor(k));
    const f = k - i0;
    const i1 = i0 + 1 >= this.keys ? 0 : i0 + 1;
    const a = i0 * BONE_COUNT * 4;
    const b = i1 * BONE_COUNT * 4;
    for (let i = 0; i < BONE_COUNT; i++)
      slerpFlat(out.q, i * 4, this.q, a + i * 4, this.q, b + i * 4, f);
    for (let c = 0; c < 3; c++) {
      const h0 = at(this.hips, i0 * 3 + c);
      out.hips[c] = h0 + (at(this.hips, i1 * 3 + c) - h0) * f;
    }
  }
}

/**
 * The clock and the weight of the loop. `step` moves the clock by the frame's dt (never by the scroll)
 * while the loop is wanted or still showing, and the weight toward its target at the blend's own pace.
 */
export class FallPlayer {
  /** Seconds into the loop. */
  time = 0;
  /** The weight shown, 0 to 1, linear in time (the actor eases it). */
  weight = 0;
  /** The weight asked for. */
  target = 0;

  get running(): boolean {
    return this.target > 0 || this.weight > 0;
  }

  /** True while the weight is on its way up. */
  get easingIn(): boolean {
    return this.weight < this.target;
  }

  step(dt: number): void {
    if (!(dt > 0)) return;
    if (this.running) this.time += dt * FALL_SPEED;
    const rate = dt / FALL_BLEND_SECONDS;
    if (this.weight < this.target) this.weight = Math.min(this.target, this.weight + rate);
    else if (this.weight > this.target) this.weight = Math.max(this.target, this.weight - rate);
  }

  reset(): void {
    this.time = 0;
    this.weight = 0;
    this.target = 0;
  }
}

const smooth = (u: number): number => u * u * (3 - 2 * u);
const seg = (v: number, a: number, b: number): number => clamp((v - a) / (b - a), 0, 1);

/**
 * The two poses of the landing, in the pose system's own terms (turns in degrees about the model's
 * axes). Wide: the arms thrown out and a little up, the legs reaching down for the palm. Low: the arms
 * come in, the knees are bent and the hips dropped, ready to push up.
 */
export const CATCH_WIDE: PoseDef = {
  turns: {
    LeftArm: [0, 0, 70],
    RightArm: [0, 0, -70],
    LeftForeArm: [-10, 0, 0],
    RightForeArm: [-10, 0, 0],
    LeftUpLeg: [-18, 0, 14],
    RightUpLeg: [-18, 0, -14],
    LeftLeg: [24, 0, 0],
    RightLeg: [24, 0, 0],
    Spine02: [-6, 0, 0],
    Head: [-6, 0, 0],
  },
};

export const CATCH_LOW: PoseDef = {
  turns: {
    LeftArm: [-18, 0, 30],
    RightArm: [-18, 0, -30],
    LeftForeArm: [-30, 0, 0],
    RightForeArm: [-30, 0, 0],
    LeftUpLeg: [-55, 0, 12],
    RightUpLeg: [-55, 0, -12],
    LeftLeg: [75, 0, 0],
    RightLeg: [75, 0, 0],
    Spine02: [10, 0, 0],
    Spine01: [6, 0, 0],
  },
  hips: [0, -0.1, 0],
};

/**
 * The landing at `t` 0 to 1: the captured fall pose to `wide` over the first 55 percent, then to
 * `low` from 45 percent on (the two overlap a little, so the motion has no stop in it). Each leg of it
 * eases in and out, so the velocity is continuous and zero at both ends.
 */
export function landPose(
  out: PoseData,
  from: PoseData,
  wide: PoseData,
  low: PoseData,
  t: number,
): void {
  const u = clamp(t, 0, 1);
  const a = smooth(seg(u, 0, 0.55));
  const b = smooth(seg(u, 0.45, 1));
  blendPoseData(out, from, wide, a);
  blendPoseData(out, out, low, b);
}

/** The standing up at `t` 0 to 1: the low pose to the pose the section asks for, easing in and out. */
export function standPose(out: PoseData, low: PoseData, target: PoseData, t: number): void {
  blendPoseData(out, low, target, smooth(clamp(t, 0, 1)));
}

/**
 * The squash on the palm: it comes on over the last 40 percent of the landing, holds, and lets go over
 * the first 45 percent of the standing up. Negative is a squash (the actor's `squash` takes it).
 */
export function landSquash(land: number, stand: number): number {
  const down = smooth(seg(land, 0.6, 1));
  const up = smooth(seg(stand, 0, 0.45));
  return -0.2 * down * (1 - up);
}
