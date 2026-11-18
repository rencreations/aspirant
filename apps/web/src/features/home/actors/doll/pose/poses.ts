// GENERATED from scripts/home/models/doll/poses.json. The poses of the doll as turns about the model's axes (degrees), in the parent's bind frame.
// Regenerate with gen.mjs in this folder. Do not edit by hand.

export interface PoseDef {
  /** Turns in degrees about the model's X, Y, Z (Euler XYZ), by bone. */
  readonly turns: Readonly<Record<string, readonly [number, number, number]>>;
  /** An offset of the root bone in the file's units (metres of the 1.7 m doll). */
  readonly hips?: readonly [number, number, number];
  readonly scales?: Readonly<Record<string, readonly [number, number, number]>>;
}

export const POSE_NAMES = [
  "rest",
  "stand",
  "ride",
  "scream",
  "fall",
  "sit",
  "run",
  "held",
  "reach",
] as const;

export type PoseName = (typeof POSE_NAMES)[number];

export const POSES: Readonly<Record<PoseName, PoseDef>> = {
  rest: { turns: {} },
  stand: {
    turns: {
      LeftArm: [0, 0, 25],
      RightArm: [0, 0, -25],
      LeftForeArm: [-10, 0, 0],
      RightForeArm: [-10, 0, 0],
    },
  },
  ride: {
    turns: {
      LeftUpLeg: [-60, 0, 45],
      RightUpLeg: [-60, 0, -45],
      LeftLeg: [55, 0, 0],
      RightLeg: [55, 0, 0],
      Spine02: [-8, 0, 0],
      Spine: [-6, 0, 0],
      LeftArm: [-75, 0, 12],
      RightArm: [-75, 0, -12],
      LeftForeArm: [-35, 0, 0],
      RightForeArm: [-35, 0, 0],
    },
    hips: [0, -0.12, 0],
  },
  scream: {
    turns: {
      LeftArm: [-82, 0, 15],
      RightArm: [-82, 0, -15],
      LeftForeArm: [-100, 0, 0],
      RightForeArm: [-100, 0, 0],
      Head: [-12, 0, 0],
      Spine02: [6, 0, 0],
    },
  },
  fall: {
    turns: {
      Hips: [-80, 0, 0],
      LeftArm: [-30, 0, 60],
      RightArm: [-60, 0, -75],
      LeftForeArm: [-20, 0, 0],
      RightForeArm: [-40, 0, 0],
      LeftUpLeg: [-20, 0, 40],
      RightUpLeg: [15, 0, -35],
      LeftLeg: [40, 0, 0],
      RightLeg: [25, 0, 0],
    },
  },
  sit: {
    turns: {
      LeftUpLeg: [-90, 0, 6],
      RightUpLeg: [-90, 0, -6],
      LeftLeg: [88, 0, 0],
      RightLeg: [92, 0, 0],
    },
    hips: [0, -0.1, 0],
  },
  run: {
    turns: {
      LeftUpLeg: [-55, 0, 0],
      LeftLeg: [15, 0, 0],
      RightUpLeg: [35, 0, 0],
      RightLeg: [85, 0, 0],
      LeftArm: [40, 0, 0],
      RightArm: [-50, 0, 0],
      LeftForeArm: [-90, 0, 0],
      RightForeArm: [-90, 0, 0],
      Spine02: [-12, 0, 0],
    },
  },
  held: {
    turns: {
      LeftArm: [0, 0, 45],
      RightArm: [0, 0, -45],
      LeftUpLeg: [6, 0, 8],
      RightUpLeg: [-4, 0, -8],
      LeftLeg: [20, 0, 0],
      RightLeg: [14, 0, 0],
      Head: [10, 0, 6],
    },
  },
  reach: {
    turns: {
      LeftArm: [-165, 0, 10],
      LeftUpLeg: [8, 0, 6],
      RightUpLeg: [10, 0, -8],
      LeftLeg: [12, 0, 0],
      RightLeg: [22, 0, 0],
      RightArm: [0, 0, -30],
      Spine02: [-6, 0, 0],
    },
    scales: { LeftArm: [1, 1.6, 1], LeftHand: [1, 0.625, 1] },
  },
};
