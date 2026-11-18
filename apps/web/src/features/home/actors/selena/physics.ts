/**
 * Hair, skirt, ears, jewellery and cloth: a spring solver that runs on top of the animated pose.
 *
 * Every spring bone has a tail point, a fixed offset in the bone's own frame (toward its child, or
 * along the chain for the last bone). The clip says where that point should be (the target). The
 * point is a particle with a velocity: a damped spring pulls it to the target, the figure's own
 * motion and the pointer push it, and a rigid length keeps it on a sphere around the bone's head.
 * The bone is then turned so that its tail points at the particle. The bones come parent first, so
 * a ponytail swings in a chain, each bone from the swing of the one above.
 *
 * The rest point is the clip's pose: there is no gravity unless a caller sets one, so the hair
 * settles exactly where the animation put it (the clip already has its hair whips in it). The step
 * is split in pieces of at most `MAX_SUBSTEP`, so 60 and 144 Hz agree, and a step of 0 changes
 * nothing. A target that jumps (a scrub) is taken with `snap()`.
 *
 * Pure: it reads and writes flat arrays (see `skeleton.ts` for the pose arrays).
 */
import { qconj, qfromTo, qmul, qrotate } from "./quat";
import { POSE_STRIDE } from "./sampler";
import type { PoseWork } from "./skeleton";

export type SpringGroup = "hair" | "ponytail" | "skirt" | "ear" | "jewelry" | "cloth";

export interface SpringParams {
  /** Natural frequency of the pull to the clip's pose, rad/s. */
  omega: number;
  /** Damping ratio: 1 settles with no swing, 0.3 swings a few times. */
  zeta: number;
  /** The most the tail may leave the clip's direction, radians. */
  maxAngle: number;
  /** How much of an outside push (wind) this group takes. */
  wind: number;
  /** How much of the figure's own movement shows as a lag (0 to 1). */
  inertia: number;
}

export interface SpringDef {
  /** The bone. */
  node: number;
  /** Its parent bone. */
  parent: number;
  /** The simulated point, in the bone's own frame (metres). */
  tail: readonly [number, number, number];
  group: SpringGroup;
}

/** What the world does to the springs this frame. */
export interface SpringEnv {
  /** How far the figure's frame moved this frame, in model space (metres). */
  shiftX: number;
  shiftY: number;
  shiftZ: number;
  /** An acceleration that pushes the tails, m/s2, in model space (a breeze, the pointer). */
  windX: number;
  windY: number;
  windZ: number;
  /** A constant pull (m/s2, along -y). Zero keeps the clip's pose exactly. */
  gravity: number;
}

const MAX_SUBSTEP = 1 / 90;
/** The longest step taken in one frame (a stalled tab must not throw the hair). */
const MAX_STEP = 1 / 20;
/** The most a frame's shift may move the particles, metres (a jump is a snap, not a swing). */
export const MAX_SHIFT = 0.06;

export const DEFAULT_PARAMS: Readonly<Record<SpringGroup, SpringParams>> = {
  hair: { omega: 24, zeta: 0.55, maxAngle: 0.9, wind: 1, inertia: 0.5 },
  ponytail: { omega: 12, zeta: 0.4, maxAngle: 0.7, wind: 1, inertia: 0.5 },
  skirt: { omega: 15, zeta: 0.5, maxAngle: 0.8, wind: 0.8, inertia: 0.4 },
  ear: { omega: 34, zeta: 0.45, maxAngle: 0.5, wind: 0.4, inertia: 0.5 },
  jewelry: { omega: 14, zeta: 0.3, maxAngle: 1.0, wind: 0.8, inertia: 0.5 },
  cloth: { omega: 18, zeta: 0.5, maxAngle: 0.8, wind: 0.8, inertia: 0.4 },
};

export function emptyEnv(): SpringEnv {
  return { shiftX: 0, shiftY: 0, shiftZ: 0, windX: 0, windY: 0, windZ: 0, gravity: 0 };
}

export class SpringBones {
  readonly count: number;
  /** The particles (three a bone) and their velocities. */
  private readonly x: Float32Array;
  private readonly v: Float32Array;
  private readonly length: Float32Array;
  private readonly params: SpringParams[];
  private fresh = true;
  private readonly t = new Float32Array(16);

  constructor(
    private readonly defs: readonly SpringDef[],
    params: Readonly<Record<SpringGroup, SpringParams>> = DEFAULT_PARAMS,
  ) {
    this.count = defs.length;
    this.x = new Float32Array(defs.length * 3);
    this.v = new Float32Array(defs.length * 3);
    this.length = Float32Array.from(defs.map((d) => Math.hypot(d.tail[0], d.tail[1], d.tail[2])));
    this.params = defs.map((d) => params[d.group]);
  }

  /** The next step starts from the clip's pose with no swing. */
  snap(): void {
    this.fresh = true;
  }

  /** Give a group (or every bone, with null) a push, in model space metres per second. */
  kick(group: SpringGroup | null, vx: number, vy: number, vz: number): void {
    for (let k = 0; k < this.count; k += 1) {
      if (group !== null && this.defs[k]!.group !== group) continue;
      this.v[k * 3] = this.v[k * 3]! + vx;
      this.v[k * 3 + 1] = this.v[k * 3 + 1]! + vy;
      this.v[k * 3 + 2] = this.v[k * 3 + 2]! + vz;
    }
  }

  /** The particle of the `k`th spring bone, in model space (for a probe). */
  particle(k: number, out: Float32Array, io: number): void {
    out[io] = this.x[k * 3]!;
    out[io + 1] = this.x[k * 3 + 1]!;
    out[io + 2] = this.x[k * 3 + 2]!;
  }

  /**
   * Advance by `dt` seconds and rewrite the rotations of the spring bones in `work` (`fq`, `mq`,
   * `mp`). `work` must have been composed from `pose` this frame. A `dt` of 0 moves no particle:
   * the bones are drawn where the last step left the tails (a frozen frame holds still).
   */
  step(dt: number, pose: Float32Array, work: PoseWork, env: SpringEnv): void {
    const step = Math.min(dt, MAX_STEP);
    const pieces = step > 0 ? Math.max(1, Math.ceil(step / MAX_SUBSTEP)) : 1;
    const h = step / pieces;
    const { mp, mq, fq } = work;
    const t = this.t;
    const x = this.x;
    const v = this.v;
    let sx = env.shiftX;
    let sy = env.shiftY;
    let sz = env.shiftZ;
    const shift = Math.hypot(sx, sy, sz);
    if (shift > MAX_SHIFT) {
      const k = MAX_SHIFT / shift;
      sx *= k;
      sy *= k;
      sz *= k;
    }

    for (let k = 0; k < this.count; k += 1) {
      const def = this.defs[k]!;
      const n = def.node;
      const p = def.parent;
      const prm = this.params[k]!;
      const o = n * POSE_STRIDE;
      // The head and the rotation the bone would have under its (already final) parent.
      qrotate(mq, p * 4, pose[o]!, pose[o + 1]!, pose[o + 2]!, t, 0);
      const hx = mp[p * 3]! + t[0]!;
      const hy = mp[p * 3 + 1]! + t[1]!;
      const hz = mp[p * 3 + 2]! + t[2]!;
      qmul(mq, p * 4, fq, n * 4, t, 4);
      // The clip's tail point.
      qrotate(t, 4, def.tail[0], def.tail[1], def.tail[2], t, 8);
      const L = this.length[k]!;
      const dx = t[8]! / L;
      const dy = t[9]! / L;
      const dz = t[10]! / L;
      const tx = hx + t[8]!;
      const ty = hy + t[9]!;
      const tz = hz + t[10]!;

      const i3 = k * 3;
      if (this.fresh) {
        x[i3] = tx;
        x[i3 + 1] = ty;
        x[i3 + 2] = tz;
        v[i3] = 0;
        v[i3 + 1] = 0;
        v[i3 + 2] = 0;
      } else if (step > 0) {
        // The figure moved: the particle stays behind by the share the bone's group allows.
        x[i3] = x[i3]! - sx * prm.inertia;
        x[i3 + 1] = x[i3 + 1]! - sy * prm.inertia;
        x[i3 + 2] = x[i3 + 2]! - sz * prm.inertia;
        const w2 = prm.omega * prm.omega;
        const damp = 2 * prm.zeta * prm.omega;
        const ax = env.windX * prm.wind;
        const ay = env.windY * prm.wind - env.gravity;
        const az = env.windZ * prm.wind;
        for (let s = 0; s < pieces; s += 1) {
          v[i3] = v[i3]! + (w2 * (tx - x[i3]) - damp * v[i3]! + ax) * h;
          v[i3 + 1] = v[i3 + 1]! + (w2 * (ty - x[i3 + 1]!) - damp * v[i3 + 1]! + ay) * h;
          v[i3 + 2] = v[i3 + 2]! + (w2 * (tz - x[i3 + 2]!) - damp * v[i3 + 2]! + az) * h;
          x[i3] = x[i3] + v[i3] * h;
          x[i3 + 1] = x[i3 + 1]! + v[i3 + 1]! * h;
          x[i3 + 2] = x[i3 + 2]! + v[i3 + 2]! * h;
        }
      }

      // The rigid length and the swing limit: the tail's direction from the head.
      let rx = x[i3]! - hx;
      let ry = x[i3 + 1]! - hy;
      let rz = x[i3 + 2]! - hz;
      const len = Math.hypot(rx, ry, rz);
      if (len > 1e-7) {
        rx /= len;
        ry /= len;
        rz /= len;
      } else {
        rx = dx;
        ry = dy;
        rz = dz;
      }
      const dot = Math.max(-1, Math.min(1, rx * dx + ry * dy + rz * dz));
      if (Math.acos(dot) > prm.maxAngle) {
        // Pull the direction back to the limit, keeping its side.
        let px = rx - dx * dot;
        let py = ry - dy * dot;
        let pz = rz - dz * dot;
        const pl = Math.hypot(px, py, pz);
        if (pl > 1e-7) {
          px /= pl;
          py /= pl;
          pz /= pl;
          const c = Math.cos(prm.maxAngle);
          const s = Math.sin(prm.maxAngle);
          rx = dx * c + px * s;
          ry = dy * c + py * s;
          rz = dz * c + pz * s;
        }
      }
      x[i3] = hx + rx * L;
      x[i3 + 1] = hy + ry * L;
      x[i3 + 2] = hz + rz * L;
      // The swing goes on along the circle, not through the length: drop the radial speed.
      const vr = v[i3]! * rx + v[i3 + 1]! * ry + v[i3 + 2]! * rz;
      v[i3] = v[i3]! - vr * rx;
      v[i3 + 1] = v[i3 + 1]! - vr * ry;
      v[i3 + 2] = v[i3 + 2]! - vr * rz;

      // Turn the bone so its tail points at the particle (in model space), then the local rotation.
      qfromTo(dx, dy, dz, rx, ry, rz, t, 12);
      qmul(t, 12, t, 4, t, 4);
      mq[n * 4] = t[4]!;
      mq[n * 4 + 1] = t[5]!;
      mq[n * 4 + 2] = t[6]!;
      mq[n * 4 + 3] = t[7]!;
      mp[n * 3] = hx;
      mp[n * 3 + 1] = hy;
      mp[n * 3 + 2] = hz;
      qconj(mq, p * 4, t, 12);
      qmul(t, 12, mq, n * 4, fq, n * 4);
    }
    this.fresh = false;
  }
}
