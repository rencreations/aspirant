/**
 * The straight head. The model was painted with the head hanging down from the neck, the snout
 * pointing about 55 degrees below the body, like a seahorse. The owner wants the head in one line
 * with the body whenever it is in its normal state, so every frame the base pose (the rest pose or a
 * baked clip) gets one more turn of the head about its joint, about the body's side axis, that
 * brings the snout level with the spine. Only the pitch is corrected: a clip's look to the side or
 * a head that is turned stays as it is. The reactions (shake, flinch, the cursor, the annoyed dip)
 * are laid on top of this turn, so they move a straight head and it returns to straight.
 *
 * All of it is in the root bone's own frame, in which the head bone and the first tail bone are
 * both children, so the spine is `head.position - tail0.position` and needs no world matrices.
 */
import { Quaternion, Vector3 } from "three";

/** The facts the straightening needs, measured once at the rest pose. */
export interface StraightRest {
  /** The snout's axis in the head bone's own frame. */
  readonly snout: Vector3;
  /** The body's axes in the root bone's own frame: forward, up and the dragon's left. */
  readonly forward: Vector3;
  readonly up: Vector3;
  readonly lateral: Vector3;
}

/** The model's axes: the head faces +Z, Y is up, the dragon's left is +X. */
const MODEL_FORWARD = [0, 0, 1] as const;
const MODEL_UP = [0, 1, 0] as const;
const MODEL_LEFT = [1, 0, 0] as const;

/**
 * Measure the rest pose. `rootQ` is the root bone's rotation in the model's frame (the file's root
 * is turned a quarter, its own X is the model's Z), `headQ` the head bone's local rotation at rest,
 * and `drop` how far below the body's forward axis the rest snout points, in radians.
 */
export function measureStraight(rootQ: Quaternion, headQ: Quaternion, drop: number): StraightRest {
  const inverseRoot = rootQ.clone().invert();
  const into = (v: readonly [number, number, number]): Vector3 =>
    new Vector3(v[0], v[1], v[2]).applyQuaternion(inverseRoot);
  const forward = into(MODEL_FORWARD);
  const up = into(MODEL_UP);
  const lateral = into(MODEL_LEFT);
  // The snout at rest: forward, turned down by `drop` about the side axis.
  const snoutRoot = forward
    .clone()
    .multiplyScalar(Math.cos(drop))
    .addScaledVector(up, -Math.sin(drop));
  const snout = snoutRoot.applyQuaternion(headQ.clone().invert());
  return { snout, forward, up, lateral };
}

/** How far above the body's level a direction points, radians (the side axis is left out of it). */
export function elevation(rest: StraightRest, x: number, y: number, z: number): number {
  const f = x * rest.forward.x + y * rest.forward.y + z * rest.forward.z;
  const u = x * rest.up.x + y * rest.up.y + z * rest.up.z;
  const l = x * rest.lateral.x + y * rest.lateral.y + z * rest.lateral.z;
  return Math.atan2(u, Math.hypot(f, l));
}

const probe = new Vector3();

/**
 * The turn about the side axis that brings the snout to the spine's own slope: radians, positive
 * lifts the nose. `headQ` is the head's local rotation in the base pose, `spine` the vector from the
 * first tail joint to the head's joint, both in the root bone's frame. The turn is about the side
 * axis, so a snout that looks a little to one side keeps its sideways part and still ends level
 * with the spine (an exact solve, not the plain difference of the two slopes).
 */
export function straightAngle(rest: StraightRest, headQ: Quaternion, spine: Vector3): number {
  probe.copy(rest.snout).applyQuaternion(headQ);
  const f = probe.dot(rest.forward);
  const u = probe.dot(rest.up);
  const l = probe.dot(rest.lateral);
  const r = Math.hypot(f, u);
  if (r < 1e-6) return 0;
  const target = elevation(rest, spine.x, spine.y, spine.z);
  // Turning by `a` about the side axis moves the (forward, up) part round by `a` and leaves the
  // sideways part. The slope after it is `target` when sin(phi + a) = sin(target) * sqrt(1 + l^2 / r^2).
  const sine = Math.sin(target) * Math.sqrt(1 + (l * l) / (r * r));
  const phi = Math.atan2(u, f);
  const to = Math.asin(Math.max(-1, Math.min(1, sine)));
  let a = to - phi;
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

const axis = new Vector3();

/**
 * The mean of `straightAngle` over a set of head rotations (the samples of a clip). A clip moves the
 * head on purpose (it dips, looks up, lunges), so it is not levelled frame by frame: it gets one
 * constant lift that puts the middle of its head motion in line with the spine, and keeps the motion.
 */
export function meanStraightAngle(
  rest: StraightRest,
  heads: readonly Quaternion[],
  spine: Vector3,
): number {
  if (heads.length === 0) return 0;
  let sum = 0;
  for (const q of heads) sum += straightAngle(rest, q, spine);
  return sum / heads.length;
}

/** The turn about the head's joint, in the root's frame: `angle` radians, positive lifts the nose. */
export function straightTurn(out: Quaternion, rest: StraightRest, angle: number): Quaternion {
  // A positive turn about the side axis drops the nose, so the lift is about its opposite.
  axis.copy(rest.lateral).negate();
  return out.setFromAxisAngle(axis, angle);
}

const keep = new Quaternion();
const back = new Quaternion();

/**
 * What a socket that must stay upright (the doll's seat on the head) has to be turned by, in its own
 * frame, to undo the straightening: `q_h0^-1 * turn^-1 * q_h0` with `q_h0` the head's rotation before
 * the turn. Multiply the socket's rest rotation by it on the left.
 */
export function uprightFix(out: Quaternion, headBefore: Quaternion, turn: Quaternion): Quaternion {
  keep.copy(headBefore).invert();
  back.copy(turn).invert();
  return out.copy(keep).multiply(back).multiply(headBefore);
}
