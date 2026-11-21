/**
 * The pulling arm (round seven, the out animation). After the out clip has put her right hand out,
 * she reaches up, takes hold of the edge of a white sheet and pulls it down. The clip has no such
 * motion, so the arm is solved here: a two bone solve (shoulder, elbow, wrist) that takes the wrist
 * to a target and keeps the elbow on the side the clip had it, plus a grip for the fingers. Pure
 * numbers on small arrays: the actor reads the composed pose, calls `solveArm` and adds the two
 * turns (`PoseWork.turnModel`), then composes again.
 */
import { qfromTo, qrotate } from "./quat";

/** The bones of her right arm and hand, as three.js names them. */
export const ARM = {
  upper: "Bip001_R_UpperArm",
  fore: "Bip001_R_Forearm",
  hand: "Bip001_R_Hand",
} as const;

/** The three bones of a finger of her right hand, root first (`Bip001_R_Finger<n>`, `<n>1`, `<n>2`). */
export function fingerBones(finger: Finger): [string, string, string] {
  const n = ["thumb", "index", "middle", "ring", "pinky"].indexOf(finger);
  const base = `Bip001_R_Finger${n}`;
  return [base, `${base}1`, `${base}2`];
}

export type Side = "L" | "R";
export type Finger = "thumb" | "index" | "middle" | "ring" | "pinky";
export const FINGERS: readonly Finger[] = ["thumb", "index", "middle", "ring", "pinky"];

/** The axis a positive angle curls a finger about, in each bone's own frame. */
export function flexAxis(side: Side, finger: Finger): readonly [number, number, number] {
  if (finger === "thumb") return side === "L" ? [0, 1, 0] : [0, -1, 0];
  return [0, 0, 1];
}

/** Per joint curl at weight 1 (knuckle, middle, tip) and the share each finger takes, radians. */
const JOINT: readonly [number, number, number] = [0.18, 0.28, 0.2];
const SHARE: Readonly<Record<Finger, number>> = {
  thumb: 0.55,
  index: 0.8,
  middle: 1,
  ring: 1.1,
  pinky: 1.25,
};
/** A closed hand in these units (the pose of a fist). The grip takes `GRIP_CURL` of it. */
const FIST = 3;
const GRIP_CURL = 0.8 * FIST;
/** The most any joint may turn. */
const MAX_JOINT = 1.35;

/** The turn of one joint of a finger for a grip of `close` (0 open, 1 closed on the edge). */
export function gripAngle(finger: Finger, joint: 0 | 1 | 2, close: number): number {
  const c = Math.min(1, Math.max(0, close));
  return Math.min(MAX_JOINT, c * GRIP_CURL * JOINT[joint] * SHARE[finger]);
}

/**
 * When each finger starts to close, as a share of the grip: the little finger first, the thumb last
 * (it comes over the edge), so the hand closes in a wave and not all at once.
 */
const LAG: Readonly<Record<Finger, number>> = {
  pinky: 0,
  ring: 0.08,
  middle: 0.16,
  index: 0.24,
  thumb: 0.34,
};

/** The close of one finger for a grip of `close`: each finger takes the last `1 - lag` of the move. */
export function fingerClose(finger: Finger, close: number): number {
  const lag = LAG[finger];
  const x = Math.min(1, Math.max(0, (close - lag) / (1 - lag)));
  return x * x * (3 - 2 * x);
}

export interface ArmTurn {
  /** The unit axis (model space) and the angle, radians. */
  ax: number;
  ay: number;
  az: number;
  angle: number;
}

export interface ArmSolve {
  upper: ArmTurn;
  fore: ArmTurn;
  /** The wrist the solve reached (model space): the target, or the nearest point the arm can reach. */
  wx: number;
  wy: number;
  wz: number;
  /** True when the target was beyond the arm's reach and was pulled in. */
  clamped: boolean;
}

export function newArmSolve(): ArmSolve {
  return {
    upper: { ax: 0, ay: 1, az: 0, angle: 0 },
    fore: { ax: 0, ay: 1, az: 0, angle: 0 },
    wx: 0,
    wy: 0,
    wz: 0,
    clamped: false,
  };
}

const q = [0, 0, 0, 1];
const pole = [0, 0, 0];

/** Write the axis and angle of the shortest turn that takes the vector u to the vector v. */
function turnBetween(
  ux: number,
  uy: number,
  uz: number,
  vx: number,
  vy: number,
  vz: number,
  out: ArmTurn,
): void {
  const lu = Math.hypot(ux, uy, uz) || 1;
  const lv = Math.hypot(vx, vy, vz) || 1;
  qfromTo(ux / lu, uy / lu, uz / lu, vx / lv, vy / lv, vz / lv, q, 0);
  const s = Math.hypot(q[0]!, q[1]!, q[2]!);
  if (s < 1e-7) {
    out.ax = 0;
    out.ay = 1;
    out.az = 0;
    out.angle = 0;
    return;
  }
  out.ax = q[0]! / s;
  out.ay = q[1]! / s;
  out.az = q[2]! / s;
  out.angle = 2 * Math.atan2(s, q[3]!);
}

/**
 * Two bone solve. `s`, `e`, `w` are the shoulder, elbow and wrist of the clip's pose (model space,
 * three numbers each from the arrays at the offsets), `t` the target for the wrist. The upper arm is
 * turned about the shoulder, then the forearm about the new elbow, so that the wrist lands on `t`
 * (or on the nearest point the arm reaches). The elbow stays on the side of the line shoulder to
 * wrist it was on in the clip. The two turns are about the model's axes, for `turnModel`.
 */
export function solveArm(
  p: ArrayLike<number>,
  s: number,
  e: number,
  w: number,
  tx: number,
  ty: number,
  tz: number,
  out: ArmSolve,
): ArmSolve {
  const sx = p[s]!;
  const sy = p[s + 1]!;
  const sz = p[s + 2]!;
  const ex = p[e]! - sx;
  const ey = p[e + 1]! - sy;
  const ez = p[e + 2]! - sz;
  const upperLen = Math.hypot(ex, ey, ez);
  const fx = p[w]! - p[e]!;
  const fy = p[w + 1]! - p[e + 1]!;
  const fz = p[w + 2]! - p[e + 2]!;
  const foreLen = Math.hypot(fx, fy, fz);

  // The target from the shoulder, pulled in to what the arm reaches.
  let dx = tx - sx;
  let dy = ty - sy;
  let dz = tz - sz;
  let d = Math.hypot(dx, dy, dz);
  const reach = upperLen + foreLen - 1e-4;
  const least = Math.abs(upperLen - foreLen) + 1e-3;
  out.clamped = d > reach || d < least;
  if (d < 1e-6) {
    dx = 0;
    dy = 0;
    dz = 1;
    d = 1;
  }
  const dd = Math.min(reach, Math.max(least, d));
  const ux = dx / d;
  const uy = dy / d;
  const uz = dz / d;

  // The elbow: along the axis by the law of cosines, off it by the pole (the clip's elbow side).
  const along = (upperLen * upperLen - foreLen * foreLen + dd * dd) / (2 * dd);
  const off = Math.sqrt(Math.max(0, upperLen * upperLen - along * along));
  // The pole: the clip's elbow offset from the line shoulder to wrist, carried to the new line by the
  // shortest turn (so the bend keeps its side and moves continuously with the target).
  const cx = p[w]! - sx;
  const cy = p[w + 1]! - sy;
  const cz = p[w + 2]! - sz;
  const cl = Math.hypot(cx, cy, cz) || 1;
  const cux = cx / cl;
  const cuy = cy / cl;
  const cuz = cz / cl;
  const k0 = ex * cux + ey * cuy + ez * cuz;
  let px = ex - k0 * cux;
  let py = ey - k0 * cuy;
  let pz = ez - k0 * cuz;
  qfromTo(cux, cuy, cuz, ux, uy, uz, q, 0);
  qrotate(q, 0, px, py, pz, pole, 0);
  px = pole[0]!;
  py = pole[1]!;
  pz = pole[2]!;
  let pl = Math.hypot(px, py, pz);
  if (pl < 1e-5) {
    // A straight arm in the clip: bend it backward (model -z), across the new line.
    const k = -uz;
    px = k * ux;
    py = k * uy;
    pz = -1 + k * uz;
    pl = Math.hypot(px, py, pz) || 1;
  }
  const nx = sx + ux * along + (px / pl) * off;
  const ny = sy + uy * along + (py / pl) * off;
  const nz = sz + uz * along + (pz / pl) * off;

  // The upper arm: its old direction to the new one.
  turnBetween(ex, ey, ez, nx - sx, ny - sy, nz - sz, out.upper);
  // The forearm: the clip's direction, carried by the upper arm's turn, to the new one.
  const half = out.upper.angle * 0.5;
  const sh = Math.sin(half);
  const qx = out.upper.ax * sh;
  const qy = out.upper.ay * sh;
  const qz = out.upper.az * sh;
  const qw = Math.cos(half);
  const tx2 = 2 * (qy * fz - qz * fy);
  const ty2 = 2 * (qz * fx - qx * fz);
  const tz2 = 2 * (qx * fy - qy * fx);
  const rx = fx + qw * tx2 + (qy * tz2 - qz * ty2);
  const ry = fy + qw * ty2 + (qz * tx2 - qx * tz2);
  const rz = fz + qw * tz2 + (qx * ty2 - qy * tx2);
  const wx = sx + ux * dd;
  const wy = sy + uy * dd;
  const wz = sz + uz * dd;
  turnBetween(rx, ry, rz, wx - nx, wy - ny, wz - nz, out.fore);
  out.wx = wx;
  out.wy = wy;
  out.wz = wz;
  return out;
}
