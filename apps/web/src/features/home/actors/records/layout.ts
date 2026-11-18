/**
 * Where the sleeves of the crate are, as pure functions. The crate's frame: metres, X along the
 * crate, Y up from its floor, Z toward the viewer. A sleeve's origin is the middle of its bottom
 * edge. At rest every sleeve is turned the same way (like records leaning in a bin) so each shows a
 * strip of its cover. With a record under the pointer the others part around it, it comes up and
 * round toward the viewer and shows its whole cover (the flip through).
 */
import { clamp, lerp, smoothstep } from "../gramophone/frame";

import { MAX_SLEEVES, SLEEVE } from "./facts";

/** The distance between two sleeves along the crate. */
export const STEP = 0.06;
/** The top of the crate's floor: sleeves stand on it. */
export const FLOOR_Y = 0.03;
/** The boards. */
const WALL = 0.02;
/** The crate with its sleeves stands this high: `place({ height })` is the on-screen height of it. */
export const BOX_HEIGHT = FLOOR_Y + SLEEVE.size + 0.04;

/** The turn of a sleeve at rest, about the vertical axis (radians). */
export const REST_YAW = 0.95;
/** The turn of the sleeve under the pointer. */
const FOCUS_YAW = 0.2;
/** A sleeve leans back, top away from the viewer (radians). */
const REST_LEAN = -0.1;
/** How far the neighbours part from the one under the pointer. */
export const GAP = 0.08;
const LIFT = 0.085;
const FORWARD = 0.15;

export interface CrateDims {
  width: number;
  depth: number;
  floor: number;
  frontHeight: number;
  backHeight: number;
  wall: number;
}

/** The crate for `n` sleeves: wide enough for the row and the one that comes round, deep enough for a sleeve turned across it. */
export function crateDims(n: number): CrateDims {
  const count = clamp(Math.round(n), 1, MAX_SLEEVES);
  const row = (count - 1) * STEP;
  // The row, the two sleeves' own width, the parting at both ends, and room by the boards.
  const width = Math.max(0.5, row + SLEEVE.size * Math.cos(REST_YAW) + GAP * 2 + 0.1 + WALL * 2);
  return {
    width,
    depth: 0.34,
    floor: FLOOR_Y,
    frontHeight: 0.085,
    backHeight: 0.2,
    wall: WALL,
  };
}

export interface SleevePose {
  x: number;
  y: number;
  z: number;
  /** About the vertical axis. */
  yaw: number;
  /** About the sleeve's own width axis (negative leans back). */
  lean: number;
}

/**
 * The pose of sleeve `i` of `n` while `focus` (a sleeve number, between whole numbers while it
 * moves) is the one in front and `reveal` (0 to 1) says how far the flip through is open.
 */
export function sleeveSlot(
  out: SleevePose,
  i: number,
  n: number,
  focus: number,
  reveal: number,
): SleevePose {
  const d = i - focus;
  const near = (1 - smoothstep(0, 1.1, Math.abs(d))) * reveal;
  const part = GAP * clamp(d, -1, 1) * reveal;
  out.x = (i - (n - 1) / 2) * STEP + part;
  out.y = FLOOR_Y + LIFT * near;
  out.z = FORWARD * near;
  out.yaw = lerp(REST_YAW, FOCUS_YAW, near);
  out.lean = REST_LEAN * (1 - near);
  return out;
}

/** The sleeve while it is shown, pulled out of the crate toward the viewer. Its slot gives `x`. */
export function sleeveShow(out: SleevePose, slotX: number): SleevePose {
  out.x = slotX * 0.35;
  out.y = FLOOR_Y + SLEEVE.size * 0.95;
  out.z = 0.17;
  out.yaw = 0.1;
  out.lean = 0.05;
  return out;
}

export function mixPose(out: SleevePose, a: SleevePose, b: SleevePose, t: number): SleevePose {
  out.x = lerp(a.x, b.x, t);
  out.y = lerp(a.y, b.y, t);
  out.z = lerp(a.z, b.z, t);
  out.yaw = lerp(a.yaw, b.yaw, t);
  out.lean = lerp(a.lean, b.lean, t);
  return out;
}
