/**
 * The numbers of `public/models/home/silverbolt.glb`, copied from its facts file
 * (`silverbolt.facts.json`, made by `scripts/home/models/`). A test reads the JSON and compares, so
 * a rebuilt model that moves a bone fails here and not on the page.
 *
 * Space: the glTF world of the file. Metres, Y up, the head faces +Z, the tail trails toward -Z. The
 * dragon's left is +X (the side of `sb_eye_L`). Every axis below is in the bone's own local frame
 * unless it says otherwise.
 */

export const SB_MODEL = "/models/home/silverbolt.glb";
export const SB_MODEL_BYTES = 343_668;

/** The model's own name for the dragon, and the key the registry uses. */
export const SB_NAME = "silverbolt";

export const BONE = {
  root: "D_she_root",
  head: "Bone02_She_01",
  jaw: "Bone02_She_02",
  cheekL: "Bone02_She_05",
  cheekR: "Bone02_She_06",
  crest: "Bone02_She_07",
  wingRoot: "Bone02_She_08",
  tongue0: "Bone02_She_19",
  tongue1: "Bone02_She_20",
  eyeL: "sb_eye_L",
  eyeR: "sb_eye_R",
} as const;

/** The six blades. Even index: the dragon's left (+X). Odd: the right. */
export const BLADES = [
  "Bone02_She_13",
  "Bone02_She_14",
  "Bone02_She_15",
  "Bone02_She_16",
  "Bone02_She_17",
  "Bone02_She_18",
] as const;

/** The tail chain, root first. Each bone hangs on the one before and aims at the next (+Y). */
export const TAIL = [
  "Bone02_She_09",
  "Bone02_She_10",
  "Bone02_She_11",
  "Bone02_She_12",
  "Bone02_She_21",
  "Bone02_She_22",
  "Bone02_She_23",
] as const;

/** Seven joints, six segments, in metres at the rest scale. */
export const TAIL_LENGTHS = [0.38, 0.4512, 0.4584, 0.4588, 0.4354, 0.3384] as const;
/** Positive angle about local +X lifts the tail, about local +Z yaws it. */
export const TAIL_PITCH_AXIS = [1, 0, 0] as const;
export const TAIL_YAW_AXIS = [0, 0, 1] as const;

/** Jaw: a positive angle about local -Z opens. Radians. */
export const JAW_AXIS = [0, 0, -1] as const;
export const JAW_ANGLE = { closed: -0.3, rest: 0, wide: 1 } as const;
/** The jaw gap in metres at the rest scale, by angle (a distance between two centres). */
export const JAW_GAP: Readonly<Record<string, number>> = {
  "-0.3": 0.112,
  "0": 0.231,
  "0.6": 0.396,
  "1": 0.488,
};

/** Tongue curl axes (local) on the two tongue bones. */
export const TONGUE_AXIS = { tongue0: [0, 0, -1], tongue1: [0, 0, 1] } as const;

type Axis = readonly [number, number, number];

/** The hinge axes of the blades, measured on the finished file: `raise` lifts the tip, `spread` opens. */
export const HINGE: Readonly<Record<string, { raise: Axis; spread: Axis }>> = {
  Bone02_She_05: { raise: [-0.549, 0.82813, 0.11317], spread: [-0.81107, -0.56054, 0.1672] },
  Bone02_She_06: { raise: [0.549, 0.82813, -0.11317], spread: [0.81107, -0.56054, -0.16719] },
  Bone02_She_07: { raise: [0.23134, 0.97287, -0.00122], spread: [0.97286, -0.23135, -0.00474] },
  Bone02_She_08: { raise: [-0.99759, 0.06933, 0], spread: [0.06933, 0.99759, 0] },
  Bone02_She_13: { raise: [-0.8955, -0.36461, 0.25523], spread: [0.35026, -0.93116, -0.10129] },
  Bone02_She_14: { raise: [0.8955, -0.36461, -0.25522], spread: [-0.35026, -0.93116, 0.10129] },
  Bone02_She_15: { raise: [-0.82472, -0.17681, 0.53719], spread: [0.04348, -0.96688, -0.25149] },
  Bone02_She_16: { raise: [0.82472, -0.17681, -0.53719], spread: [-0.04348, -0.96688, 0.25149] },
  Bone02_She_17: { raise: [0.88487, -0.43248, -0.1731], spread: [-0.44831, -0.89157, -0.06422] },
  Bone02_She_18: { raise: [0.88487, 0.43248, -0.1731], spread: [0.44831, -0.89157, 0.06422] },
};

/** The length of each blade bone, from its head to its tip, in metres at the rest scale. */
export const BLADE_LENGTH: Readonly<Record<string, number>> = {
  Bone02_She_05: 0.643,
  Bone02_She_06: 0.643,
  Bone02_She_08: 0.416,
  Bone02_She_13: 0.372,
  Bone02_She_14: 0.371,
  Bone02_She_15: 0.279,
  Bone02_She_16: 0.28,
  Bone02_She_17: 0.369,
  Bone02_She_18: 0.369,
};

/** The clips of the file. The names keep the source's spelling. Durations in seconds. */
export const CLIP = {
  idle: "city_idle",
  idleStanding: "city_idle_BP",
  toPose: "city_interaction_R",
  toIdle: "city_interaction_back_R",
  handsToMouth: "city_interaction_R_loop",
  interaction03: "city_intercation03",
  flightPath: "city_action",
} as const;

export type ClipName = (typeof CLIP)[keyof typeof CLIP];

export const CLIP_DURATION: Readonly<Record<ClipName, number>> = {
  city_interaction_R: 3.291667,
  city_interaction_back_R: 3.208333,
  city_idle: 2.708333,
  city_idle_BP: 2.041667,
  city_interaction_R_loop: 2.708333,
  city_intercation03: 6.291667,
  city_action: 15.958333,
};

/** The loops wrap on their duration. */
export const CLIP_LOOPS: Readonly<Record<ClipName, boolean>> = {
  city_interaction_R: false,
  city_interaction_back_R: false,
  city_idle: true,
  city_idle_BP: true,
  city_interaction_R_loop: true,
  city_intercation03: false,
  city_action: false,
};

/**
 * The body block that `place({ height })` measures: the vertical extent, in metres at the rest
 * scale, of the head with its horns, the wing blades and the chin, seen from the front. Measured
 * in the lab (1440 by 900, rest pose, front): `place({ height: 300 })` drew a silhouette 303 px
 * tall, so the block is 1.0 m to within 1 percent. The whole dragon is about 3.5 of these long.
 */
export const BODY_HEIGHT_M = 1.0;
/**
 * Where the body block is centred, in the model's rest space. Measured the same way: with y 3.66
 * the front silhouette sat 23 px (0.078 m) low, so the centre of the block is at y 3.58. Z is
 * where a turn (`yaw`) pivots: between the head and the wing root.
 */
export const BODY_CENTRE = [0, 3.58, -0.3] as const;
/**
 * How far below the body's level the rest head's snout points, radians. The model hangs its head
 * down from the neck (about 55 degrees, like a seahorse); `straight.ts` turns it up by this much and
 * the spine's own slope. Measured on side views of the rest pose, tuned by eye: 0.9 to 1.0 all read
 * as one straight dragon.
 */
export const HEAD_DROP = 0.92;
/** The scale of the clips: the 1.4 m dragon that stands beside Selena. */
export const CLIP_SCALE = 0.4;
/**
 * The doll is 0.12 m in the game's own scale, where the dragon is the 1.4 m of the clips (a
 * scale of 0.4). A socket lives in the model's own space, 1 unit = 1 m of the 3.5 m dragon, so a
 * doll parented to a socket must be 0.12 / 0.4 = 0.30 m tall there. Then the root scale of a clip
 * and the `place` scale both carry it to the right size on screen.
 */
export const DOLL_SOCKET_M = 0.3;
