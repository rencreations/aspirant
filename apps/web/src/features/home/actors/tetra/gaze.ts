import { clamp, ramp } from "./ease";

/**
 * Where she looks. A point on the screen (the pointer, the drone, whatever a section names) turns
 * her head and her eyes toward it. The eyes get there first, then the head, then a little of the
 * body. A point far across the page is let go of: she is not left staring off to one side.
 */
export interface Gaze {
  /** The head's turn about up (positive looks to the right of the screen) and its nod (positive looks down). */
  yaw: number;
  nod: number;
}

/**
 * The look of the head for a point at (`px`, `py`) when her face is at (`hx`, `hy`) on the screen
 * (y down, CSS pixels) and she is `tall` pixels high. Writes into `out`. `held` is how far the
 * point is let go of with distance, so a pointer across the page does not turn her head.
 */
export function gazeFor(
  px: number,
  py: number,
  hx: number,
  hy: number,
  tall: number,
  out: Gaze,
): number {
  const reach = Math.max(120, 1.5 * tall);
  const far = Math.hypot(px - hx, py - hy) / Math.max(1, tall);
  const held = 1 - ramp(1.3, 2.4, far);
  out.yaw = clamp((px - hx) / reach, -1, 1) * 0.52 * held;
  out.nod = clamp((py - hy) / reach, -1, 1) * 0.5 * held;
  return held;
}
