/**
 * The faked hang by one hand. The rig cannot do it: its arm is 0.52 of a 1.7 tall doll and the head
 * and hair are 59 percent of her height, so an arm raised straight up ends inside the hair, behind
 * the bangs, from every side (checked at yaw 0 to 90). So the doll hangs the way a cartoon one does:
 *
 *  - the left arm is raised (104 degrees about Z) and stretched three times its length, the rig's
 *    stretch recipe (the upper arm bone is scaled, the hand bone is scaled back so the mitten stays
 *    small, never the forearm), which brings the mitten out above the crown of the hair;
 *  - the pivot of her root is that hand (the section puts the hand where the ledge is);
 *  - her root is rolled about the hand so that the line from the hand to her hips points straight
 *    down on the screen (about 24 degrees at this arm), with a small pendulum on top.
 *
 * A forward arm (the `reach` pose) was tried and rejected: the hand is then in front of the face and
 * the roll that hangs her is 55 to 75 degrees, which reads as lying on her side.
 */

import type { PoseDef } from "./pose/poses";

/**
 * The pose a hang is built on: the left arm raised and stretched three times (never the forearm),
 * the other arm and the legs limp, the head dropped a little. Tuned on the lab sheet `hang4`.
 */
export const HANG_POSE: PoseDef = {
  turns: {
    LeftArm: [0, 0, 104],
    RightArm: [0, 0, 40],
    LeftUpLeg: [6, 0, 8],
    RightUpLeg: [-4, 0, -8],
    LeftLeg: [20, 0, 0],
    RightLeg: [14, 0, 0],
    Head: [10, 0, 6],
  },
  scales: { LeftArm: [1, 3, 1], LeftHand: [1, 1 / 3, 1] },
};

/**
 * The roll (radians, about the screen's Z axis) that makes the vector `(vx, vy, vz)`, from the hand to the body in the
 * doll's model frame, point straight down once the doll has been turned by `yaw` about her
 * vertical axis and tipped by `pitch` about X. Pure geometry.
 */
export function rollToHang(vx: number, vy: number, vz: number, yaw: number, pitch: number): number {
  // Yaw about Y.
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = vx * cy + vz * sy;
  const z1 = -vx * sy + vz * cy;
  // Pitch about X.
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const y2 = vy * cp - z1 * sp;
  // The roll that turns (x1, y2) onto (0, -1): atan2 of the vector, then the quarter turn.
  return -Math.PI / 2 - Math.atan2(y2, x1);
}

/** An angle in radians brought into -pi to pi. */
export function wrapPi(a: number): number {
  const turn = Math.PI * 2;
  return a - turn * Math.round(a / turn);
}

/**
 * The pendulum of the hang as a function of time: a slow swing and a faster small one, plus a
 * decaying swing from a push (`kick` seconds ago, `kickSize` radians). Radians.
 */
export function hangSway(t: number, amount: number, kickAge = Infinity, kickSize = 0): number {
  const idle = 0.09 * Math.sin(t * 1.5) + 0.035 * Math.sin(t * 3.7 + 1.3);
  const push = kickAge < 6 ? kickSize * Math.exp(-kickAge * 0.7) * Math.cos(kickAge * 4.2) : 0;
  return amount * idle + push;
}
