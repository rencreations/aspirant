/**
 * Where the hand is and how big, in the stage's pixel frame, as pure functions. The frame: origin
 * at the middle of the viewport, x right, y up, one unit one CSS pixel at z = 0; the cast's camera is
 * perspective at `CAMERA_DISTANCE`, so a thing at depth z is drawn `CAMERA_DISTANCE / (CAMERA_DISTANCE - z)`
 * times larger than at z = 0.
 *
 * The page looks at the hand as if from the visitor's elbow (`ELBOW`). The camera of the stage sits
 * in the middle of the screen, so a hand low on the screen is seen from above more steeply than a
 * hand at the centre. `viewRotation` turns the hand so that, wherever it rests, the stage's camera
 * sees it the way the elbow camera does: the same side of the palm, the same foreshortening.
 */
import { Matrix4, Quaternion, Vector3 } from "three";

import { ELBOW } from "./constants";
import { clamp, easeInOutCubic, easeOutCubic, smoothstep } from "./motion";

export const CAMERA_DISTANCE = 1000;
/** Nothing is placed nearer the camera than this share of its distance (the scale would run away). */
const NEAR_LIMIT = 0.9;

/** How much larger a thing at `z` is drawn than at z = 0. */
export function depthScale(z: number): number {
  return CAMERA_DISTANCE / (CAMERA_DISTANCE - Math.min(z, CAMERA_DISTANCE * NEAR_LIMIT));
}

/** The screen position of a world point (stage pixels) and how much that point is magnified. */
export function projectToStage(
  out: { x: number; y: number; s: number },
  x: number,
  y: number,
  z: number,
): { x: number; y: number; s: number } {
  const s = depthScale(z);
  out.x = x * s;
  out.y = y * s;
  out.s = s;
  return out;
}

const _eye = new Vector3();
const _target = new Vector3();
const _up = new Vector3(0, 1, 0);
const _m = new Matrix4();
const _wc = new Vector3();
const _d = new Vector3();
const _los = new Quaternion();
const _extra = new Quaternion();
const _axisX = new Vector3(1, 0, 0);
const _axisY = new Vector3(0, 1, 0);
const _axisZ = new Vector3(0, 0, 1);
const _q1 = new Quaternion();
const _q2 = new Quaternion();

let elbow: Quaternion | null = null;
let towardWrist: Vector3 | null = null;

/** The rotation from the hand's space to the elbow camera's space, and where the wrist is in it. */
function elbowView(): { rotation: Quaternion; wrist: Vector3 } {
  if (!elbow || !towardWrist) {
    _eye.set(...ELBOW.position);
    _target.set(...ELBOW.target);
    _m.lookAt(_eye, _target, _up);
    // The look-at matrix maps camera axes to hand axes: the view is its inverse.
    elbow = new Quaternion().setFromRotationMatrix(_m).invert();
    towardWrist = _eye.clone().negate().applyQuaternion(elbow).normalize();
  }
  return { rotation: elbow, wrist: towardWrist };
}

/**
 * The hand's rotation when its wrist is seen at the screen point (x, y): the elbow view, carried
 * along the line of sight from the stage's camera to the wrist. The line of sight depends only on
 * where the wrist is on the screen, not on its depth. `roll` turns the hand about the screen's own
 * axis (the wrist is the pivot), `yaw` and `pitch` are small taste adjustments, all in radians.
 */
export function viewRotation(
  out: Quaternion,
  x: number,
  y: number,
  roll = 0,
  yaw = 0,
  pitch = 0,
): Quaternion {
  const view = elbowView();
  _d.set(x, y, -CAMERA_DISTANCE).normalize();
  _wc.copy(view.wrist);
  _los.setFromUnitVectors(_wc, _d);
  _extra
    .setFromAxisAngle(_axisZ, roll)
    .multiply(_q1.setFromAxisAngle(_axisY, yaw))
    .multiply(_q2.setFromAxisAngle(_axisX, pitch));
  return out.copy(_extra).multiply(_los).multiply(view.rotation);
}

const _p = new Vector3();

/**
 * The scale (stage pixels to a metre of the model, at the wrist's depth) that makes the hand
 * `height` pixels tall on the screen: from the wrist, seen at the screen height `y`, to its highest
 * fingertip, with the rotation `q` and the perspective of the depth `z`. `tips` are the claw tips in
 * the hand's space, three numbers each. The perspective makes the answer depend on itself, so it
 * is found in a few steps.
 */
export function fitScale(
  height: number,
  tips: ArrayLike<number>,
  q: Quaternion,
  y: number,
  z: number,
): number {
  const wy = y / depthScale(z);
  let k = 2000;
  for (let it = 0; it < 8; it += 1) {
    let top = -Infinity;
    for (let i = 0; i + 2 < tips.length; i += 3) {
      _p.set(tips[i]!, tips[i + 1]!, tips[i + 2])
        .applyQuaternion(q)
        .multiplyScalar(k);
      const sy = (wy + _p.y) * depthScale(z + _p.z);
      if (sy > top) top = sy;
    }
    const extent = top - y;
    if (!(extent > 1e-3)) break;
    k *= height / extent;
  }
  return Math.max(1, k);
}

/**
 * The wrist's y when the hand is fully below the bottom edge of a screen `stageH` tall: even the
 * highest claw (about `height` above the wrist, a little more with the perspective) is out of sight.
 */
export function hiddenY(stageH: number, height: number, margin = 60): number {
  return -stageH / 2 - height * 1.3 - margin;
}

/**
 * How far from hidden to rest the hand is, 0 to 1, from the rise (0 to 1) and the sink (0 to 1).
 * The hand arrives quickly and settles; it leaves the same way in reverse.
 */
export function lift(rise: number, sink: number): number {
  return Math.max(0, easeOutCubic(rise) - easeInOutCubic(sink));
}

/**
 * How far the baked reach has played, 0 (a flat hand) to 1 (the open palm). The fingers open in the
 * middle of the rise, and relax a little again as the hand sinks.
 */
export function reachProgress(rise: number, sink: number, relax = 0.3): number {
  return smoothstep(0.08, 0.92, rise) * (1 - relax * clamp(sink, 0, 1));
}
