/**
 * The two named poses the opening and the sections need, as a state a section sets and the drone
 * blends into and out of (the home's rule: a section sets the state every frame, it does not play
 * an event).
 *
 *  - "peek": the drone has stepped to the edge of the screen and looks at something: it turns its
 *    face and its eyes toward the thing, leans, and makes itself a little small. `dir` is the side
 *    the thing is on, -1 left and 1 right.
 *  - "thanks": a bow with the kind face. The bow is played once when the
 *    pose is entered; the kind face and the happy fins stay while the pose does.
 *
 * Everything is in the screen frame (y down). `dx` and `dy` are in widths of the drone. No three here.
 */
import { clamp01, mix } from "./ease";
import type { FaceName } from "./faces";
import { bowCurve, TRICK_SECONDS } from "./tricks";

export type PoseName = "peek" | "thanks";

export interface PoseState {
  current: PoseName | null;
  /** Seconds since the pose was entered, held while it blends out. */
  t: number;
  /** 0 to 1: how far the pose is worn. */
  amount: number;
}

export interface PoseLook {
  yaw: number;
  pitch: number;
  roll: number;
  dx: number;
  dy: number;
  eyeX: number;
  eyeY: number;
  scale: number;
  happy: number;
  droop: number;
  face: FaceName | null;
}

export function createPoseState(): PoseState {
  return { current: null, t: 0, amount: 0 };
}

export function createPoseLook(): PoseLook {
  return {
    yaw: 0,
    pitch: 0,
    roll: 0,
    dx: 0,
    dy: 0,
    eyeX: 0,
    eyeY: 0,
    scale: 1,
    happy: 0,
    droop: 0,
    face: null,
  };
}

export function stepPose(
  s: PoseState,
  wanted: PoseName | null,
  dir: number,
  dt: number,
  out: PoseLook,
): PoseLook {
  out.yaw = 0;
  out.pitch = 0;
  out.roll = 0;
  out.dx = 0;
  out.dy = 0;
  out.eyeX = 0;
  out.eyeY = 0;
  out.scale = 1;
  out.happy = 0;
  out.droop = 0;
  out.face = null;

  if (wanted && wanted !== s.current) {
    s.current = wanted;
    s.t = 0;
  }
  const k = 1 - Math.exp(-7 * Math.max(0, dt));
  s.amount = mix(s.amount, wanted ? 1 : 0, k);
  if (!wanted && s.amount < 0.005) {
    s.amount = 0;
    s.current = null;
  }
  if (!s.current) return out;
  // The clock runs while the pose is wanted; it holds still while the pose blends out.
  if (wanted) s.t += Math.max(0, dt);

  const a = s.amount;
  const side = dir < 0 ? -1 : 1;
  if (s.current === "peek") {
    out.yaw = side * 0.6 * a;
    out.roll = -side * 0.2 * a;
    out.pitch = -0.08 * a;
    out.dx = side * 0.05 * a;
    out.eyeX = side * a;
    out.eyeY = 0.15 * a;
    out.scale = 1 - 0.05 * a;
    out.droop = 0.15 * a;
  } else {
    const p = clamp01(s.t / TRICK_SECONDS.bow);
    const c = bowCurve(p);
    out.pitch = 0.72 * c * a;
    out.dy = 0.07 * c * a;
    out.happy = a;
    out.face = a > 0.4 ? "thanks" : null;
  }
  return out;
}

export function clearPose(s: PoseState): void {
  s.current = null;
  s.t = 0;
  s.amount = 0;
}
