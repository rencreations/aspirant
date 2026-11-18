/**
 * The points on her body that the actor projects to the screen every frame: for the gaze, the
 * hit targets, the fingers' reach and the sockets. Each is a bone and an offset along the bone's
 * own forward axis (+X in this rig: the bones point along their local x). Bone names are the ones
 * three.js gives.
 */
import { BONE, PONYTAIL_L, PONYTAIL_R, fingerBones } from "./constants";
import { FINGERS } from "./fingers";

export interface PointSpec {
  bone: string;
  /** Metres along the bone's forward axis. */
  along: number;
}

/** The index of every named point in the projected array. */
export const POINT = {
  eyes: 0,
  head: 1,
  headTop: 2,
  neck: 3,
  pelvis: 4,
  spine2: 5,
  handL: 6,
  handR: 7,
  tipsL: 8,
  tipsR: 13,
  ponyL: 18,
  ponyR: 23,
  propL: 28,
  propR: 29,
  thighL: 30,
  calfL: 31,
  footL: 32,
  thighR: 33,
  calfR: 34,
  footR: 35,
  frontHair: 36,
  handEndL: 37,
  handEndR: 38,
  count: 39,
} as const;

/** The specs in index order. `eyes` is the middle of the two eye bones (handled by the actor). */
export function pointSpecs(): PointSpec[] {
  const specs: PointSpec[] = [];
  specs[POINT.eyes] = { bone: BONE.eyeL, along: 0 };
  specs[POINT.head] = { bone: BONE.head, along: 0.06 };
  specs[POINT.headTop] = { bone: BONE.head, along: 0.19 };
  specs[POINT.neck] = { bone: BONE.neck, along: 0 };
  specs[POINT.pelvis] = { bone: BONE.pelvis, along: 0 };
  specs[POINT.spine2] = { bone: BONE.spine[2], along: 0 };
  specs[POINT.handL] = { bone: BONE.handL, along: 0.05 };
  specs[POINT.handR] = { bone: BONE.handR, along: 0.05 };
  FINGERS.forEach((finger, f) => {
    // The last bone of the chain, a little beyond its head: the fingertip.
    specs[POINT.tipsL + f] = { bone: fingerBones("L", finger)[2]!, along: 0.03 };
    specs[POINT.tipsR + f] = { bone: fingerBones("R", finger)[2]!, along: 0.03 };
  });
  PONYTAIL_L.slice(1).forEach((bone, i) => {
    specs[POINT.ponyL + i] = { bone, along: 0 };
  });
  PONYTAIL_R.slice(1).forEach((bone, i) => {
    specs[POINT.ponyR + i] = { bone, along: 0 };
  });
  // The ends of the two long strands (the last bone, a little beyond its head).
  specs[POINT.ponyL + 4] = { bone: PONYTAIL_L[4], along: 0.2 };
  specs[POINT.ponyR + 4] = { bone: PONYTAIL_R[4], along: 0.2 };
  specs[POINT.propL] = { bone: BONE.propL, along: 0 };
  specs[POINT.propR] = { bone: BONE.propR, along: 0 };
  specs[POINT.thighL] = { bone: BONE.thighL, along: 0 };
  specs[POINT.calfL] = { bone: "Bip001_L_Calf", along: 0 };
  specs[POINT.footL] = { bone: BONE.footL, along: 0.05 };
  specs[POINT.thighR] = { bone: BONE.thighR, along: 0 };
  specs[POINT.calfR] = { bone: "Bip001_R_Calf", along: 0 };
  specs[POINT.footR] = { bone: BONE.footR, along: 0.05 };
  specs[POINT.frontHair] = { bone: "Bone01_Hair_F_03", along: 0.05 };
  // The far end of the hand along its own bone, which the fingers' curl does not move: the hand's
  // hit target must not change shape when she makes a fist.
  specs[POINT.handEndL] = { bone: BONE.handL, along: 0.14 };
  specs[POINT.handEndR] = { bone: BONE.handR, along: 0.14 };
  return specs;
}
