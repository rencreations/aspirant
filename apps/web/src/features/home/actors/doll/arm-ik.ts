/**
 * A two bone arm solver in WORLD space, for a hand that holds something (the dragon's crest). The
 * rig's bones are Blender frames and the two sides are not mirrors, so nothing here is a turn about
 * a model axis: each bone is swung by the shortest rotation that takes its current direction to the
 * wanted one, and the result is written back as a local quaternion. Run after the pose, the layers and
 * `placeRoot` have set the matrices, and before the ink and the hit shapes read them.
 *
 * The elbow is placed by the law of cosines on the circle the shoulder and the target leave, on the
 * side the pole points to (out and down). An arm that cannot reach is stretched up to `maxStretch`
 * (the rig's recipe: the upper arm bone is scaled, the hand bone scaled back) and then stops short on
 * the line to the target, never flipping. Nothing is allocated per call.
 */
import { Quaternion, Vector3, type Bone } from "three";

export interface ArmChain {
  readonly arm: Bone;
  readonly fore: Bone;
  readonly hand: Bone;
}

const _s = new Vector3();
const _e = new Vector3();
const _w = new Vector3();
const _v = new Vector3();
const _dir = new Vector3();
const _perp = new Vector3();
const _cur = new Vector3();
const _want = new Vector3();
const _goal = new Vector3();
const _q = new Quaternion();
const _wq = new Quaternion();
const _pq = new Quaternion();

/** The elbow's place: on the circle of points `l1` from the shoulder and `l2` from the target. Pure on vectors. */
function elbowPlace(
  out: Vector3,
  shoulder: Vector3,
  target: Vector3,
  l1: number,
  l2: number,
  pole: Vector3,
): Vector3 {
  _v.subVectors(target, shoulder);
  const d = Math.max(1e-6, _v.length());
  _dir.copy(_v).divideScalar(d);
  const cosA = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const sinA = Math.sqrt(1 - cosA * cosA);
  _perp.copy(pole).addScaledVector(_dir, -pole.dot(_dir));
  if (_perp.lengthSq() < 1e-8) {
    // The pole is along the arm: any side will do.
    _perp.set(0, 0, 1).addScaledVector(_dir, -_dir.z);
    if (_perp.lengthSq() < 1e-8) _perp.set(1, 0, 0);
  }
  _perp.normalize();
  return out
    .copy(shoulder)
    .addScaledVector(_dir, l1 * cosA)
    .addScaledVector(_perp, l1 * sinA);
}

/** Swing a bone so that the line from its origin to `child` points along `want` (all in world space). */
function swing(bone: Bone, from: Vector3, child: Vector3, want: Vector3): void {
  _cur.subVectors(child, from);
  const len = _cur.length();
  if (len < 1e-9) return;
  _cur.divideScalar(len);
  _q.setFromUnitVectors(_cur, want);
  bone.getWorldQuaternion(_wq);
  _wq.premultiply(_q);
  if (bone.parent) {
    bone.parent.getWorldQuaternion(_pq);
    _pq.invert();
    bone.quaternion.copy(_pq.multiply(_wq));
  } else {
    bone.quaternion.copy(_wq);
  }
  bone.updateMatrixWorld(true);
}

export interface ArmSolve {
  /** How far the hand reached the wanted point, 0 to 1 (1 on it). */
  reach: number;
}

const _result: ArmSolve = { reach: 1 };

/**
 * Bring the hand of `chain` to `target` (world), by `weight` 0 to 1 (0 leaves the posed arm alone).
 * `pole` is a world direction the elbow bends toward. `maxStretch` (1 for none) lets the arm grow to
 * reach. The matrices of the chain must be current on entry; they are on exit.
 */
export function solveArm(
  chain: ArmChain,
  target: Vector3,
  weight: number,
  pole: Vector3,
  maxStretch: number,
  baseArmScaleY: number,
  baseHandScaleY: number,
): ArmSolve {
  _result.reach = 1;
  if (!(weight > 0)) return _result;
  const { arm, fore, hand } = chain;
  arm.getWorldPosition(_s);
  fore.getWorldPosition(_e);
  hand.getWorldPosition(_w);
  _goal.lerpVectors(_w, target, Math.min(1, weight));
  let l1 = _s.distanceTo(_e);
  let l2 = _e.distanceTo(_w);
  if (l1 < 1e-6 || l2 < 1e-6) return _result;
  _v.subVectors(_goal, _s);
  const d = _v.length();
  const reach = l1 + l2;
  if (maxStretch > 1 && d > 0.97 * reach) {
    const k = Math.min(maxStretch, d / (0.97 * reach));
    arm.scale.y = baseArmScaleY * k;
    hand.scale.y = baseHandScaleY / k;
    arm.updateMatrixWorld(true);
    fore.getWorldPosition(_e);
    hand.getWorldPosition(_w);
    l1 = _s.distanceTo(_e);
    l2 = _e.distanceTo(_w);
  }
  const reachNow = l1 + l2;
  const lo = Math.abs(l1 - l2) + 1e-4;
  const dc = Math.max(lo, Math.min(d, 0.985 * reachNow));
  _result.reach = d > 1e-6 ? Math.min(1, dc / d) : 1;
  // The goal pulled onto the reachable sphere.
  _dir.copy(_v).divideScalar(Math.max(d, 1e-6));
  _goal.copy(_s).addScaledVector(_dir, dc);
  elbowPlace(_v, _s, _goal, l1, l2, pole);
  // Upper arm: toward the elbow.
  _want.subVectors(_v, _s).normalize();
  swing(arm, _s, _e, _want);
  // Forearm: from where the elbow is now, toward the goal.
  fore.getWorldPosition(_e);
  hand.getWorldPosition(_w);
  _want.subVectors(_goal, _e).normalize();
  swing(fore, _e, _w, _want);
  return _result;
}
