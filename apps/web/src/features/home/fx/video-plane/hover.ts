/**
 * The hover of the film plane: three effects, each an amount, and a way to choose. The video keeps
 * playing under all of them. The shader draws the lens and the colour split; the tilt and the shift
 * of the picture are written by the actor from the numbers here. There is no light that follows the
 * pointer (the owner took the sweep away, round five).
 *
 *   lens    the picture swells under the pointer and a ripple runs out from it
 *   split   the colour parts on the pointer's side of the frame
 *   tilt    the frame leans toward the pointer and the picture shifts inside it
 */
import { qFromEuler, type Q } from "../image-field/math";

export interface HoverWeights {
  lens: number;
  split: number;
  tilt: number;
}

export type HoverMode = "signature" | "lens" | "split" | "tilt" | "off";

export const HOVER_MODES: Readonly<Record<HoverMode, HoverWeights>> = {
  /** The three together, each held back so none shouts. */
  signature: { lens: 0.7, split: 0.8, tilt: 1 },
  lens: { lens: 1, split: 0, tilt: 0 },
  split: { lens: 0, split: 1, tilt: 0 },
  tilt: { lens: 0, split: 0, tilt: 1 },
  off: { lens: 0, split: 0, tilt: 0 },
};

/** How far the frame leans (radians at the edge of the frame) and how far the picture shifts and swells. */
export const TILT = { x: 0.2, y: 0.26, shift: 0.035, zoom: 0.07 } as const;

/**
 * The frame's lean toward a pointer at (`px`, `py`) (fractions of the frame from its centre, y up),
 * scaled by how much it is hovered. The side of the pointer comes toward the viewer.
 */
export function tiltQuat(px: number, py: number, amount: number, out: Q): Q {
  return qFromEuler(py * TILT.x * amount, -px * TILT.y * amount, 0, out);
}

/**
 * The hover amount of a plane is a critically damped spring (round eight): no overshoot, and it starts
 * and ends gently, so a cursor that leaves never snaps the frame flat. Angular speeds (rad/s): a
 * critically damped spring is within 2 percent of its target after about 5.8 / omega seconds, so
 * entering takes about 0.4 s and leaving about 0.6 s.
 */
export const HOVER_IN_OMEGA = 14;
export const HOVER_OUT_OMEGA = 9.5;
/**
 * The pointer's place on a plane (fractions of the frame) follows the real pointer on a low pass of this
 * rate per second while hovered, and is HELD where it was once the cursor has left, so the lean, the
 * shift and the lens ease back from where they were instead of jumping to the middle first.
 */
export const POINTER_FOLLOW_RATE = 18;
/** Below this hover amount the held pointer may jump to the real one (nothing shows of it yet). */
export const POINTER_SNAP_BELOW = 0.02;
