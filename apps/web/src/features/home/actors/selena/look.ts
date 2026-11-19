/**
 * Where she looks (round seven): the head and the eyes follow the cursor, only a little. The cursor
 * is a share of the screen from her eyes (-1 to 1 on each axis) and the turns are small and capped,
 * so the look is gentle but still seen. The eyes lead the head: they turn farther than it does.
 * Pure maths, in radians.
 */
import { clamp } from "./motion";

export interface GentleLimits {
  /** The most the head (with the neck) turns sideways, either way. */
  headYaw: number;
  /** The most the head nods, up or down. */
  headPitch: number;
  eyeYaw: number;
  eyePitch: number;
}

/** About 8 degrees sideways and 5 up for the head, a few more for the eyes. */
export const GENTLE: GentleLimits = {
  headYaw: 0.14,
  headPitch: 0.09,
  eyeYaw: 0.2,
  eyePitch: 0.13,
};

export interface Gaze {
  headYaw: number;
  headPitch: number;
  eyeYaw: number;
  eyePitch: number;
}

export function emptyGaze(): Gaze {
  return { headYaw: 0, headPitch: 0, eyeYaw: 0, eyePitch: 0 };
}

/**
 * The turns for a cursor at (`nx`, `ny`), each in -1 to 1 (right and up are positive). The cursor
 * is clamped, so it never twists her whatever it does. Writes into `out`.
 */
export function gentleGaze(nx: number, ny: number, out: Gaze, limits: GentleLimits = GENTLE): Gaze {
  const x = clamp(nx, -1, 1);
  const y = clamp(ny, -1, 1);
  out.headYaw = limits.headYaw * x;
  out.headPitch = limits.headPitch * y;
  out.eyeYaw = limits.eyeYaw * x;
  out.eyePitch = limits.eyePitch * y;
  return out;
}
