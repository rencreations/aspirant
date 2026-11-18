import { clamp01 } from "@/features/about/choreo/ease";

import { key, type Key } from "./curves";

/**
 * A script for the carry of the opening: the two drones come in with the logo and it is too heavy.
 * `t` is the seconds since they began to carry it. They manage, then it gets heavy, they heave,
 * they drop it (a jolt, a sag), try again with everything they have, and hold on, tired. `help`
 * (0 to 1) is the normal drone coming to lift with them: it takes the weight off, the strain goes
 * out of their faces and the logo rises.
 *
 * The section may use this or write its own: the duo only asks for three numbers a frame
 * (`tension`, `struggle`, `lift`, see `carry`).
 */
export interface CarryState {
  tension: number;
  struggle: number;
  lift: number;
}

const STRUGGLE: readonly Key[] = [
  [0, 0.25],
  [1.0, 0.45],
  [1.8, 0.8],
  [2.3, 1.0],
  [2.6, 0.9],
  [3.3, 0.95],
  [3.9, 1.0],
  [5.0, 0.78],
];

const LIFT: readonly Key[] = [
  [0, 0.35],
  [1.2, 0.3],
  [1.8, 0.1],
  [2.2, 0.45, "out"],
  [2.45, -0.7, "in"],
  [2.9, -0.55],
  [3.4, 0.0],
  [3.9, 0.35, "back"],
  [5.5, 0.05],
];

const TENSION: readonly Key[] = [
  [0, 0.3],
  [1.8, 0.7],
  [2.3, 0.95],
  [3.9, 1.0],
  [5.0, 0.8],
];

/** The state at a time. Never outside the ranges the duo takes. */
export function carryScript(t: number, help = 0): CarryState {
  const h = clamp01(help);
  const struggle = key(t, STRUGGLE) * (1 - 0.85 * h);
  const tension = key(t, TENSION) * (1 - 0.7 * h);
  const lift = key(t, LIFT) * (1 - h) + 0.5 * h;
  return { tension, struggle, lift };
}
