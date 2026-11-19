/**
 * Where the doll sits on the drone, as arithmetic (round six). The drone is drawn in a lens of its
 * own (`actors/drone/scene.ts`), so nothing can be parented to its bones: the pair computes where the
 * top of its helmet is on the screen for the pose it is drawn in this frame, and the doll is put under
 * a node of the cast scene at that place (the seat). No scene here, only `Quaternion` and `Vector3`
 * as numbers, and nothing is allocated per call.
 */
import { Euler, Quaternion, Vector3 } from "three";

import { BODY_METRES, DISTANCE, VIEW_HEIGHT } from "../drone/model";

/** Model metres (the drone's frame: +Y up, +Z its face). The top of the helmet between the fins. */
export const HEAD_TOP: readonly [number, number, number] = [0, 0.158, 0.02];
/** Her hands rest on the dome in front of her hips: this far to each side, down and forward of `HEAD_TOP`. */
export const GRIP_REST: readonly [number, number, number] = [0.05, -0.012, 0.085];
/** The tip of the right fin as the viewer sees it (the drone's left), for a high five. */
export const FIN_TIP: readonly [number, number, number] = [-0.15, 0.2, -0.045];
/** The drone's face, for the doll to look down at. */
export const FACE_POINT: readonly [number, number, number] = [0, -0.04, 0.2];

/** What the drone is drawn at: the screen frame (middle origin, y DOWN) and its attitude. */
export interface DroneDrawLike {
  x: number;
  y: number;
  size: number;
  yaw: number;
  pitch: number;
  roll: number;
}

/** The seat: a point in the stage frame (y UP), the turn of the drone, and the pixels in a metre. */
export interface HeadFrame {
  x: number;
  y: number;
  perMetre: number;
  readonly q: Quaternion;
}

export function createHeadFrame(): HeadFrame {
  return { x: 0, y: 0, perMetre: 1, q: new Quaternion() };
}

const _e = new Euler(0, 0, 0, "YXZ");
const _v = new Vector3();

/** The drone's turn as a quaternion (the order the scene draws it in: yaw, then pitch, then roll). */
export function droneTurn(d: DroneDrawLike, out: Quaternion): Quaternion {
  _e.set(d.pitch, d.yaw, d.roll, "YXZ");
  return out.setFromEuler(_e);
}

/** The model's metres in pixels at the drone's drawn size. */
export function perMetreOf(size: number): number {
  return Math.max(1, size) / BODY_METRES;
}

/**
 * A point of the model, `p` in metres, as the lens draws it: stage frame, y up, into `out`. The lens is
 * 20 degrees at 8 m, so a point toward the camera is a little bigger and farther from the middle.
 * `stageHeight` is the viewport's height in px (the view spans `VIEW_HEIGHT` world units of it).
 */
export function modelToStage(
  d: DroneDrawLike,
  q: Quaternion,
  p: readonly [number, number, number],
  stageHeight: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  const perMetre = perMetreOf(d.size);
  _v.set(p[0], p[1], p[2]).applyQuaternion(q);
  const zWorld = (_v.z * perMetre * VIEW_HEIGHT) / Math.max(1, stageHeight);
  const k = DISTANCE / (DISTANCE - Math.min(zWorld, DISTANCE * 0.8));
  out.x = d.x + _v.x * perMetre * k;
  out.y = -d.y + _v.y * perMetre * k;
  return out;
}

/** The head frame of the drone for this draw, into `out`. */
export function headFrame(d: DroneDrawLike, stageHeight: number, out: HeadFrame): HeadFrame {
  droneTurn(d, out.q);
  out.perMetre = perMetreOf(d.size);
  modelToStage(d, out.q, HEAD_TOP, stageHeight, out);
  return out;
}
