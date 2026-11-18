/**
 * The tail of Silverbolt as pure maths: a chain of joints (xyz triples in one flat array, in the
 * stage's pixel frame), a FABRIK solver for a drag, and a damped follower that makes the tail lag
 * behind the body's motion and swing back after a drag. No three.js here: `actor.ts` reads the
 * joint positions off the animated bones, calls these, and writes the result back as rotations.
 */
import { clamp } from "./math";

/** Segment lengths: a typed array (the actor's) or a plain list (a test's). */
export type Lengths = readonly number[] | Float64Array;

/** The total length of a chain. */
export function chainLength(lengths: Lengths): number {
  let sum = 0;
  for (const length of lengths) sum += length;
  return sum;
}

/**
 * Put joint `j` at distance `len` from joint `i`, along the direction it already has from `i`.
 * A joint that sits exactly on `i` is pushed along `fallback` (the chain must never collapse).
 */
function place(
  p: Float64Array,
  i: number,
  j: number,
  len: number,
  fx: number,
  fy: number,
  fz: number,
): void {
  let dx = p[3 * j]! - p[3 * i]!;
  let dy = p[3 * j + 1]! - p[3 * i + 1]!;
  let dz = p[3 * j + 2]! - p[3 * i + 2]!;
  let d = Math.hypot(dx, dy, dz);
  if (d < 1e-9) {
    dx = fx;
    dy = fy;
    dz = fz;
    d = Math.hypot(dx, dy, dz) || 1;
  }
  const k = len / d;
  p[3 * j] = p[3 * i]! + dx * k;
  p[3 * j + 1] = p[3 * i + 1]! + dy * k;
  p[3 * j + 2] = p[3 * i + 2]! + dz * k;
}

function tipGap(p: Float64Array, n: number, tx: number, ty: number, tz: number): number {
  return Math.hypot(p[3 * (n - 1)]! - tx, p[3 * (n - 1) + 1]! - ty, p[3 * (n - 1) + 2]! - tz);
}

/**
 * FABRIK (forward and backward reaching inverse kinematics) on `p`, in place. The root joint (0)
 * stays where it is. The tip is brought to `(tx, ty, tz)`, or as near as the chain can reach (a
 * straight line toward it). Returns the distance left between the tip and the target.
 */
export function fabrik(
  p: Float64Array,
  lengths: Lengths,
  tx: number,
  ty: number,
  tz: number,
  iterations = 8,
  tolerance = 0.01,
): number {
  const n = lengths.length + 1;
  const rx = p[0]!;
  const ry = p[1]!;
  const rz = p[2]!;
  const reach = chainLength(lengths);
  const toTarget = Math.hypot(tx - rx, ty - ry, tz - rz);
  if (toTarget >= reach) {
    // Out of reach: lay the chain straight toward the target.
    const k = toTarget > 1e-9 ? 1 / toTarget : 0;
    let along = 0;
    for (let i = 1; i < n; i++) {
      along += lengths[i - 1]!;
      p[3 * i] = rx + (tx - rx) * k * along;
      p[3 * i + 1] = ry + (ty - ry) * k * along;
      p[3 * i + 2] = rz + (tz - rz) * k * along;
    }
    return toTarget - reach;
  }
  for (let it = 0; it < iterations; it++) {
    // Backward: the tip goes to the target, every joint follows.
    p[3 * (n - 1)] = tx;
    p[3 * (n - 1) + 1] = ty;
    p[3 * (n - 1) + 2] = tz;
    for (let i = n - 2; i >= 0; i--) place(p, i + 1, i, lengths[i]!, 0, 0, -1);
    // Forward: the root goes back where it was.
    p[0] = rx;
    p[1] = ry;
    p[2] = rz;
    for (let i = 0; i < n - 1; i++) place(p, i, i + 1, lengths[i]!, 0, 0, -1);
    if (tipGap(p, n, tx, ty, tz) < tolerance) break;
  }
  return tipGap(p, n, tx, ty, tz);
}

/** How much of the drag each joint takes: nothing at the root, all of it at the tip, a soft curve between. */
export function dragWeights(joints: number): Float64Array {
  const w = new Float64Array(joints);
  for (let i = 0; i < joints; i++) {
    const t = i / Math.max(1, joints - 1);
    w[i] = Math.pow(t, 1.7);
  }
  return w;
}

export interface DragOptions {
  /** The most the tip may be pulled away from where the animation puts it, as a share of the tail's length. */
  maxPull: number;
  iterations?: number;
}

/**
 * The drag pose. `base` is where the animation puts the joints. The tip is pulled toward the
 * pointer (at most `maxPull` of the tail's length from its own place, so the drag cannot look
 * wrong), every joint first takes a share of that pull (`dragWeights`, so the bend is smooth), then
 * FABRIK makes the lengths exact and the tip reach. The result goes to `out`.
 * Returns the pull in effect, in the same unit as the positions.
 */
export function dragPose(
  base: Float64Array,
  lengths: Lengths,
  weights: Float64Array,
  tx: number,
  ty: number,
  tz: number,
  options: DragOptions,
  out: Float64Array,
): number {
  const n = lengths.length + 1;
  const tipX = base[3 * (n - 1)]!;
  const tipY = base[3 * (n - 1) + 1]!;
  const tipZ = base[3 * (n - 1) + 2]!;
  let dx = tx - tipX;
  let dy = ty - tipY;
  let dz = tz - tipZ;
  const pull = Math.hypot(dx, dy, dz);
  const limit = options.maxPull * chainLength(lengths);
  if (pull > limit && pull > 1e-9) {
    const k = limit / pull;
    dx *= k;
    dy *= k;
    dz *= k;
  }
  for (let i = 0; i < n; i++) {
    const w = weights[i]!;
    out[3 * i] = base[3 * i]! + dx * w;
    out[3 * i + 1] = base[3 * i + 1]! + dy * w;
    out[3 * i + 2] = base[3 * i + 2]! + dz * w;
  }
  fabrik(out, lengths, tipX + dx, tipY + dy, tipZ + dz, options.iterations ?? 8);
  return Math.min(pull, limit);
}

export interface FollowOptions {
  /** Natural frequency (rad/s) of each joint's pull toward the animated place. Joint 0 is pinned. */
  omega: ArrayLike<number>;
  zeta: number;
}

/**
 * The tail's body: positions and velocities of the joints, a damped follower with fixed lengths.
 * Each frame the animated joints (`base`) are where the tail wants to be; the joints chase them on
 * springs, softer toward the tip, so the tail trails when the body moves and swings back after a
 * drag. The root joint is pinned to the animation. After the spring step the lengths are made exact
 * (position based, the velocity is re-read from the move so a constraint adds no energy).
 */
export class TailBody {
  readonly q: Float64Array;
  private readonly v: Float64Array;
  private readonly before: Float64Array;

  constructor(readonly joints: number) {
    this.q = new Float64Array(3 * joints);
    this.v = new Float64Array(3 * joints);
    this.before = new Float64Array(3 * joints);
  }

  /** Jump to the animated pose with no motion (a hidden actor, a jump of the scroll). */
  snap(base: Float64Array): void {
    this.q.set(base.subarray(0, 3 * this.joints));
    this.v.fill(0);
  }

  /** Remove the speed (a drag lets go of the tail's old momentum). */
  still(): void {
    this.v.fill(0);
  }

  step(
    dt: number,
    base: Float64Array,
    lengths: Lengths,
    follow: FollowOptions,
    /** When set, the joints chase these positions (a drag solution) at `omega`, not `base`. */
    pull?: { target: Float64Array; omega: number },
  ): void {
    const n = this.joints;
    const q = this.q;
    const v = this.v;
    if (!(dt > 0)) return;
    const steps = Math.max(1, Math.ceil(dt * 120));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      this.before.set(q);
      // The root follows the animation exactly.
      for (let k = 0; k < 3; k++) {
        q[k] = base[k]!;
        v[k] = 0;
      }
      for (let i = 1; i < n; i++) {
        const omega = pull ? pull.omega : (follow.omega[i] ?? 6);
        const target = pull ? pull.target : base;
        for (let k = 0; k < 3; k++) {
          const at = 3 * i + k;
          const vel =
            v[at]! +
            (omega * omega * (target[at]! - q[at]!) - 2 * follow.zeta * omega * v[at]!) * h;
          v[at] = vel;
          q[at] = q[at]! + vel * h;
        }
      }
      // Lengths: from the root out, each joint keeps its own distance from the one before.
      for (let i = 0; i < n - 1; i++) {
        place(q, i, i + 1, lengths[i]!, 0, 0, -1);
      }
      // The velocity is what the joint really did.
      for (let i = 1; i < 3 * n; i++) {
        v[i] = clamp((q[i]! - this.before[i]!) / h, -1e5, 1e5);
      }
    }
  }

  /** The largest distance between a joint and its animated place. */
  deviation(base: Float64Array): number {
    let worst = 0;
    for (let i = 0; i < this.joints; i++) worst = Math.max(worst, gap(this.q, base, i));
    return worst;
  }
}

function gap(a: Float64Array, b: Float64Array, i: number): number {
  return Math.hypot(
    a[3 * i]! - b[3 * i]!,
    a[3 * i + 1]! - b[3 * i + 1]!,
    a[3 * i + 2]! - b[3 * i + 2]!,
  );
}
