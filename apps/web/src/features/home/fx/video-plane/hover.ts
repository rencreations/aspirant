/**
 * The hover of the film plane: four effects, each an amount, and a way to choose. The video keeps
 * playing under all of them. The shader draws the lens, the colour split and the sweep; the tilt
 * and the shift of the picture are written by the actor from the numbers here.
 *
 *   lens    the picture swells under the pointer and a ripple runs out from it
 *   split   the colour parts on the pointer's side of the frame
 *   tilt    the frame leans toward the pointer and the picture shifts inside it
 *   sweep   a band and a spot of light follow the pointer
 */
import { qFromEuler, type Q } from "../image-field/math";

export interface HoverWeights {
  lens: number;
  split: number;
  tilt: number;
  sweep: number;
}

export type HoverMode = "signature" | "lens" | "split" | "tilt" | "sweep" | "off";

export const HOVER_MODES: Readonly<Record<HoverMode, HoverWeights>> = {
  /** The four together, each held back so none shouts. */
  signature: { lens: 0.7, split: 0.8, tilt: 1, sweep: 0.9 },
  lens: { lens: 1, split: 0, tilt: 0, sweep: 0 },
  split: { lens: 0, split: 1, tilt: 0, sweep: 0 },
  tilt: { lens: 0, split: 0, tilt: 1, sweep: 0 },
  sweep: { lens: 0, split: 0, tilt: 0, sweep: 1 },
  off: { lens: 0, split: 0, tilt: 0, sweep: 0 },
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

/** The ease of a hover toward its target, per second. */
export const HOVER_RATE = 9;
