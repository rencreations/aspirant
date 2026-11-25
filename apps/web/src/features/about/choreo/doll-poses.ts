/**
 * The Obsidia doll's poses while she rides the drone on the About page. The same form as the home's
 * own poses (`features/home/actors/doll/pose/poses.ts`): turns in degrees about the model's axes
 * (X her left, Y up, Z her front), in the parent's bind frame, by bone. Her arms hang down in the
 * bind pose: a turn about X below 0 raises an arm forward and up, about Z it swings it out (the left
 * arm with a turn above 0, the right with one below). A thigh turned below 0 about X comes forward,
 * a knee above 0 bends. The trunk and the head lean forward above 0.
 *
 * `seat` is always under her: every other pose is blended over it by its weight (`DollFrame`).
 * The seat is the home's rider pose (`RIDE_POSE` in `ride.ts`) with the hands down on the helmet,
 * as she has no grips to hold on this drone.
 */
export interface DollPoseDef {
  readonly turns: Readonly<Record<string, readonly [number, number, number]>>;
}

export const DOLL_POSE_NAMES = [
  "hold",
  "cheer",
  "wave",
  "wheee",
  "point",
  "hug",
  "clap",
  "stretch",
  "scared",
  "peek",
  "cheeks",
] as const;

export type DollPoseName = (typeof DOLL_POSE_NAMES)[number];

export const DOLL_SEAT: DollPoseDef = {
  turns: {
    LeftUpLeg: [-80, 0, 13],
    RightUpLeg: [-80, 0, -13],
    LeftLeg: [80, 0, 0],
    RightLeg: [84, 0, 0],
    Spine02: [-5, 0, 0],
    Spine: [-3, 0, 0],
    LeftArm: [-28, 0, 26],
    RightArm: [-28, 0, -26],
    LeftForeArm: [-28, 0, 0],
    RightForeArm: [-28, 0, 0],
  },
};

export const DOLL_POSES: Readonly<Record<DollPoseName, DollPoseDef>> = {
  /** Holding on tight in a fast flight: low over the helmet, hands flat on it, knees in. */
  hold: {
    turns: {
      Spine02: [16, 0, 0],
      Spine: [10, 0, 0],
      Head: [-14, 0, 0],
      LeftArm: [-48, 0, 12],
      RightArm: [-48, 0, -12],
      LeftForeArm: [-18, 0, 0],
      RightForeArm: [-18, 0, 0],
      LeftUpLeg: [-86, 0, 6],
      RightUpLeg: [-86, 0, -6],
      LeftLeg: [100, 0, 0],
      RightLeg: [104, 0, 0],
    },
  },
  /** Both arms thrown up. */
  cheer: {
    turns: {
      Spine02: [-8, 0, 0],
      Head: [-10, 0, 0],
      LeftArm: [-168, 0, 26],
      RightArm: [-168, 0, -26],
      LeftForeArm: [-14, 0, 0],
      RightForeArm: [-14, 0, 0],
      LeftUpLeg: [-92, 0, 16],
      RightUpLeg: [-92, 0, -16],
      LeftLeg: [60, 0, 0],
      RightLeg: [64, 0, 0],
    },
  },
  /** Her right arm up and out, ready to wave (the wave itself is added). */
  wave: {
    turns: {
      RightArm: [-140, 0, -42],
      RightForeArm: [-38, 0, 0],
      Spine02: [-3, 0, -5],
      Head: [0, 0, 6],
    },
  },
  /** A roller coaster: arms up and wide, leaning back, feet kicked out. */
  wheee: {
    turns: {
      Spine02: [-14, 0, 0],
      Spine: [-6, 0, 0],
      Head: [-16, 0, 0],
      LeftArm: [-152, 0, 44],
      RightArm: [-152, 0, -44],
      LeftForeArm: [-8, 0, 0],
      RightForeArm: [-8, 0, 0],
      LeftUpLeg: [-100, 0, 18],
      RightUpLeg: [-100, 0, -18],
      LeftLeg: [36, 0, 0],
      RightLeg: [40, 0, 0],
    },
  },
  /** Pointing ahead with her right arm, the left fist on her hip. */
  point: {
    turns: {
      RightArm: [-92, 0, -8],
      RightForeArm: [-4, 0, 0],
      LeftArm: [-10, 0, 52],
      LeftForeArm: [-95, 0, 0],
      Spine02: [4, 0, 0],
    },
  },
  /** Lying forward on the helmet, hugging it, her cheek on it. */
  hug: {
    turns: {
      Spine02: [30, 0, 0],
      Spine: [14, 0, 0],
      Head: [12, 0, 16],
      LeftArm: [-42, 0, -22],
      RightArm: [-42, 0, 22],
      LeftForeArm: [-62, 0, 0],
      RightForeArm: [-62, 0, 0],
      LeftUpLeg: [-70, 0, 14],
      RightUpLeg: [-70, 0, -14],
      LeftLeg: [110, 0, 0],
      RightLeg: [112, 0, 0],
    },
  },
  /** Hands together in front of her (the clap itself is added). */
  clap: {
    turns: {
      LeftArm: [-72, 0, -6],
      RightArm: [-72, 0, 6],
      LeftForeArm: [-58, 0, 0],
      RightForeArm: [-58, 0, 0],
      Head: [-4, 0, 0],
    },
  },
  /** A big stretch with a yawn. */
  stretch: {
    turns: {
      Spine02: [-12, 0, 0],
      Spine: [-6, 0, 0],
      Head: [-22, 0, 0],
      LeftArm: [-176, 0, 12],
      RightArm: [-176, 0, -12],
      LeftForeArm: [-20, 0, 0],
      RightForeArm: [-20, 0, 0],
    },
  },
  /** Hands up to her face, shrinking. */
  scared: {
    turns: {
      Spine02: [12, 0, 0],
      Head: [10, 0, 0],
      LeftArm: [-108, 0, -22],
      RightArm: [-108, 0, 22],
      LeftForeArm: [-112, 0, 0],
      RightForeArm: [-112, 0, 0],
      LeftUpLeg: [-92, 0, 4],
      RightUpLeg: [-92, 0, -4],
      LeftLeg: [112, 0, 0],
      RightLeg: [114, 0, 0],
    },
  },
  /** Leaning over the front of the helmet to look down at the page. */
  peek: {
    turns: {
      Spine02: [28, 0, 0],
      Spine: [10, 0, 0],
      Head: [26, 0, 0],
      LeftArm: [-40, 0, 14],
      RightArm: [-40, 0, -14],
      LeftForeArm: [-10, 0, 0],
      RightForeArm: [-10, 0, 0],
    },
  },
  /** Both hands on her cheeks (for hearts, and for a giggle). */
  cheeks: {
    turns: {
      LeftArm: [-104, 0, -26],
      RightArm: [-104, 0, 26],
      LeftForeArm: [-124, 0, 0],
      RightForeArm: [-124, 0, 0],
      Head: [4, 0, 0],
    },
  },
};
