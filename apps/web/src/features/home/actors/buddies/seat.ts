/**
 * Where the doll sits on the drone, as arithmetic (round six, made exact in round eight). The drone is
 * drawn in the stage's pixel world through a lens of its own (`actors/drone/scene.ts`), and the doll
 * who rides it is put in that same scene, so the drone's body and her body are sorted by one depth
 * buffer. Nothing is parented to the drone's bones: the pair computes where the top of its helmet is
 * in that world for the pose it is drawn in this frame (a point, and the drone's turn), and the doll
 * is put under a node at that place (the seat). No scene here, only `Quaternion` and `Vector3` as
 * numbers, and nothing is allocated per call.
 */
import { Euler, Quaternion, Vector3 } from "three";

import { BODY_METRES, DISTANCE, VIEW_HEIGHT } from "../drone/model";

/** Model metres (the drone's frame: +Y up, +Z its face). The top of the helmet between the fins. */
const HEAD_TOP: readonly [number, number, number] = [
  0, 0.158, 0.02,
]; /** The drone's face, for the doll to look down at. */
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

/**
 * The seat: a point of the stage's pixel world (x right, y UP, z toward the viewer), the turn of the
 * drone, and the pixels in a metre of the model.
 */
export interface HeadFrame {
  x: number;
  y: number;
  z: number;
  perMetre: number;
  readonly q: Quaternion;
}

export function createHeadFrame(): HeadFrame {
  return { x: 0, y: 0, z: 0, perMetre: 1, q: new Quaternion() };
}

const _e = new Euler(0, 0, 0, "YXZ");
const _v = new Vector3();

/** The drone's turn as a quaternion (the order the scene draws it in: yaw, then pitch, then roll). */
function droneTurn(d: DroneDrawLike, out: Quaternion): Quaternion {
  _e.set(d.pitch, d.yaw, d.roll, "YXZ");
  return out.setFromEuler(_e);
}

/** The model's metres in pixels at the drone's drawn size. */
function perMetreOf(size: number): number {
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

/**
 * The head frame of the drone for this draw, into `out`: the true place of the top of the helmet in the
 * world the drone is drawn in. The lens magnifies it as it does the drone, so nothing is approximated.
 */
export function headFrame(d: DroneDrawLike, out: HeadFrame): HeadFrame {
  droneTurn(d, out.q);
  const perMetre = perMetreOf(d.size);
  out.perMetre = perMetre;
  _v.set(HEAD_TOP[0], HEAD_TOP[1], HEAD_TOP[2]).applyQuaternion(out.q);
  out.x = d.x + _v.x * perMetre;
  out.y = -d.y + _v.y * perMetre;
  out.z = _v.z * perMetre;
  return out;
}
