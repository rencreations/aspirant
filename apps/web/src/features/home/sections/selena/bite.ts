import { CubicInterpolant } from "three";

// Corrections to the flight in Selena's model space, in metres. The baked flight
// dives towards the lens here. In short-1 the snout sweeps across her open palm.
const keys = [
  [1.6, 0, 0, 0],
  [2.35, 0.225, -0.008, 0.011],
  [2.85, 0.085, 0.028, -0.065],
  [3.15, 0.044, 0.138, -0.048],
  [3.42, 0.077, 0.148, -0.114],
  [3.55, 0.14, 0.19, -0.13],
  [3.66, 0.127, 0.223, -0.313],
  [3.75, -0.169, 0.284, -0.511],
  [3.83, -0.002, 0.327, -0.294],
  [3.96, 0.024, 0.402, 0.06],
  [4.6, 0, 0, 0],
] as const;

export const biteFlight = new CubicInterpolant(
  new Float32Array(keys.map(([t]) => t)),
  new Float32Array(keys.flatMap(([, x, y, z]) => [x, y, z])),
  3,
);
