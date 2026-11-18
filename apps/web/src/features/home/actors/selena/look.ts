/**
 * Where she looks. The gaze is split between the eyes, the head and the neck the way a person's
 * is: a small turn is the eyes alone, a larger one brings the head (and a little of the neck), and
 * each part has a limit, so a cursor behind her never twists her. Pure maths, in radians.
 */
import { clamp } from "./motion";

export interface LookLimits {
  /** The most the head and neck turn sideways. */
  headYaw: number;
  headUp: number;
  headDown: number;
  /** The most the eyes turn on their own, either way. */
  eyeYaw: number;
  eyeUp: number;
  eyeDown: number;
  /** A turn smaller than this is the eyes alone. */
  deadZone: number;
  /** The share of the head's turn that the neck takes (the head takes the rest). */
  neckShare: number;
}

export const LIMITS: LookLimits = {
  headYaw: 0.62,
  headUp: 0.36,
  headDown: 0.5,
  eyeYaw: 0.42,
  eyeUp: 0.28,
  eyeDown: 0.3,
  deadZone: 0.1,
  neckShare: 0.35,
};

export interface Gaze {
  neckYaw: number;
  neckPitch: number;
  headYaw: number;
  headPitch: number;
  eyeYaw: number;
  eyePitch: number;
}

export function emptyGaze(): Gaze {
  return { neckYaw: 0, neckPitch: 0, headYaw: 0, headPitch: 0, eyeYaw: 0, eyePitch: 0 };
}

/**
 * Yaw (about up, positive turns toward +x) and pitch (positive looks up) of a direction in her own
 * frame: she faces +z, up is +y.
 */
export function gazeAngles(
  x: number,
  y: number,
  z: number,
  out: { yaw: number; pitch: number } = { yaw: 0, pitch: 0 },
): { yaw: number; pitch: number } {
  out.yaw = Math.atan2(x, z);
  out.pitch = Math.atan2(y, Math.hypot(x, z));
  return out;
}

function share(angle: number, dead: number, limitUp: number, limitDown: number): number {
  const a = Math.abs(angle);
  if (a <= dead) return 0;
  const turn = (a - dead) * 0.9;
  return angle > 0 ? Math.min(turn, limitUp) : -Math.min(turn, limitDown);
}

/** Split a wanted gaze (yaw, pitch) into the neck, the head and the eyes. Writes into `out`. */
export function splitGaze(
  yaw: number,
  pitch: number,
  out: Gaze,
  limits: LookLimits = LIMITS,
): Gaze {
  const headYaw = share(yaw, limits.deadZone, limits.headYaw, limits.headYaw);
  const headPitch = share(pitch, limits.deadZone, limits.headUp, limits.headDown);
  out.neckYaw = headYaw * limits.neckShare;
  out.neckPitch = headPitch * limits.neckShare;
  out.headYaw = headYaw - out.neckYaw;
  out.headPitch = headPitch - out.neckPitch;
  out.eyeYaw = clamp(yaw - headYaw, -limits.eyeYaw, limits.eyeYaw);
  out.eyePitch = clamp(pitch - headPitch, -limits.eyeDown, limits.eyeUp);
  return out;
}
