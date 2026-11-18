/**
 * Where the drone is, in the two frames it lives in. No three here.
 *
 * The STAGE frame is the home's pixel frame, the one an actor's `place()` speaks: origin at the
 * middle of the viewport, x to the right, y UP, one unit one CSS pixel on the plane z = 0. A
 * position nearer the camera (z > 0) is drawn bigger and farther from the middle, as the shared
 * perspective camera (1000 px away) would draw it.
 *
 * The drone's own motion is the About page's, ported as it is, and that works in a SCREEN frame:
 * origin at the middle, x to the right, y DOWN, CSS pixels. Keeping it there means no sign of the
 * flight, the pitch or the eyes had to be worked out again. This file is the only pair of doors
 * between the two.
 */
import { SIZE_PER_HEIGHT } from "./model";

/** How far the camera of the stage is from the plane z = 0 (`PIXEL_DISTANCE` of the kernel). */
export const STAGE_DEPTH = 1000;

/** What a section gives `place()`. Angles in radians. */
export interface DronePlace {
  /** The middle of the drone, in the stage frame (y up). */
  x: number;
  y: number;
  /** Pixels toward the camera. The drone is drawn bigger and farther from the middle as it nears. Default 0. */
  z?: number;
  /** The on-screen height of the drone upright with its wings at rest, in CSS pixels at z = 0. */
  height: number;
  /** The attitude it takes when it is not flying. Yaw turns the face to the right of the screen. */
  yaw?: number;
  /** Pitch puts the nose down. */
  pitch?: number;
  /** Roll is anticlockwise as the visitor sees it. */
  roll?: number;
}

/** The target the follower springs toward, in the screen frame. `yaw` and `pitch` are the rest attitude. */
export interface Target {
  x: number;
  y: number;
  /** The About size: the model's `BODY_METRES` across, in pixels. */
  size: number;
  yaw: number;
  pitch: number;
  roll: number;
}

/** The largest depth that is still in front of the camera; nearer than this is cut. */
const NEAR_LIMIT = 0.95 * STAGE_DEPTH;

/** How much a thing at depth `z` is magnified (1 at z = 0). */
export function depthScale(z: number): number {
  return STAGE_DEPTH / (STAGE_DEPTH - Math.min(z, NEAR_LIMIT));
}

/** The yaw a drone at screen `x` takes to face the middle of the page, so it never looks out of it. */
export function defaultYaw(x: number, width: number): number {
  const side = Math.max(-1, Math.min(1, x / Math.max(1, width / 2)));
  return -side * 0.38;
}

/** Write a place of the stage frame into a target of the screen frame. `width` is the viewport's. */
export function placeToTarget(place: DronePlace, width: number, out: Target): Target {
  const k = depthScale(place.z ?? 0);
  out.x = place.x * k;
  out.y = -place.y * k;
  out.size = place.height * k * SIZE_PER_HEIGHT;
  out.yaw = place.yaw ?? defaultYaw(out.x, width);
  out.pitch = place.pitch ?? 0;
  out.roll = place.roll ?? 0;
  return out;
}

/** A pointer in client pixels (top left, y down) in the screen frame (middle, y down). */
export function clientToScreen(
  clientX: number,
  clientY: number,
  width: number,
  height: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  out.x = clientX - width / 2;
  out.y = clientY - height / 2;
  return out;
}

/** A step of the target this long, in one frame, is a jump: the drone is put there, not flown. */
const JUMP_DIAGONALS = 0.9;

export function isJump(
  from: { x: number; y: number },
  to: { x: number; y: number },
  width: number,
  height: number,
): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) > JUMP_DIAGONALS * Math.hypot(width, height);
}
