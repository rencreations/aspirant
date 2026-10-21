/* Written by scripts/roster/build.py. Do not edit. */
export interface RosterClip {
  readonly bytes: number;
  readonly seconds: number;
  readonly mode: "patch" | "fill";
  /** patch: the middle and size of the recording in the splash art, as fractions of it. */
  readonly box?: readonly [number, number, number, number];
  /** fill: the face in the recording, as fractions across and down. */
  readonly face?: readonly [number, number];
}

export const ROSTER_CLIPS: Readonly<Record<string, RosterClip>> = {
  guinevere: {
    bytes: 4302117,
    seconds: 12.52,
    mode: "patch",
    box: [0.604, 0.3793, 0.1904, 0.3628],
  },
  lesley: {
    bytes: 2496292,
    seconds: 7.95,
    mode: "patch",
    box: [0.5981, 0.3741, 0.1904, 0.3628],
  },
  obsidia: {
    bytes: 4330130,
    seconds: 12.22,
    mode: "patch",
    box: [0.4805, 0.1884, 0.1426, 0.2726],
  },
  selena: {
    bytes: 3311028,
    seconds: 12.05,
    mode: "fill",
    face: [0.44, 0.32],
  },
  vexana: {
    bytes: 3442617,
    seconds: 7.12,
    mode: "patch",
    box: [0.5962, 0.4505, 0.1045, 0.1997],
  },
};

/** The size of the cropped picture, width over height. */
export const CLIP_RATIO = 0.92952;
