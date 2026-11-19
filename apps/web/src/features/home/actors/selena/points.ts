/**
 * The points on her body that the actor projects to the screen every frame: for the gaze, the
 * placement probes and `screenPoint`. Each is a bone and an offset along the bone's own forward
 * axis (+X in this rig: the bones point along their local x). Bone names are the ones three.js gives.
 */
import { BONE } from "./constants";

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
  pelvis: 3,
  handL: 4,
  handR: 5,
  footL: 6,
  footR: 7,
  count: 8,
} as const;

/** The specs in index order. `eyes` is the middle of the two eye bones (handled by the actor). */
export function pointSpecs(): PointSpec[] {
  const specs: PointSpec[] = [];
  specs[POINT.eyes] = { bone: BONE.eyeL, along: 0 };
  specs[POINT.head] = { bone: BONE.head, along: 0.06 };
  specs[POINT.headTop] = { bone: BONE.head, along: 0.19 };
  specs[POINT.pelvis] = { bone: BONE.pelvis, along: 0 };
  specs[POINT.handL] = { bone: BONE.handL, along: 0.05 };
  specs[POINT.handR] = { bone: BONE.handR, along: 0.05 };
  specs[POINT.footL] = { bone: BONE.footL, along: 0.05 };
  specs[POINT.footR] = { bone: BONE.footR, along: 0.05 };
  return specs;
}
