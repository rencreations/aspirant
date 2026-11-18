// GENERATED from apps/web/public/models/home/doll-rig.json. The bind pose of the doll's 22 bones, the sockets and the facts the actor needs.
// Regenerate with gen.mjs in this folder. Do not edit by hand.

export interface RigBone {
  readonly name: string;
  readonly parent: string | null;
  /** The rest rotation in the parent's frame: x, y, z, w. */
  readonly q: readonly [number, number, number, number];
  /** The rest position in the parent's frame (the file's metres). */
  readonly p: readonly [number, number, number];
  /** The bind position in the file's frame. */
  readonly world: readonly [number, number, number];
}

/** Parents come before children. */
export const RIG_BONES: readonly RigBone[] = [
  {
    name: "Hips",
    parent: null,
    q: [-0.026264, -0.004478, -0.004478, 0.999635],
    p: [-0.000123, 0.396164, 0.000171],
    world: [-0.00012, 0.39616, 0.00017],
  },
  {
    name: "Spine02",
    parent: "Hips",
    q: [0, 0, 0, 1],
    p: [0, 0.053853, 0],
    world: [0.00037, 0.44994, -0.00265],
  },
  {
    name: "Spine01",
    parent: "Spine02",
    q: [0, 0, 0, 1],
    p: [0, 0.053853, 0],
    world: [0.00087, 0.50372, -0.00548],
  },
  {
    name: "Spine",
    parent: "Spine01",
    q: [-0.000013, -0.001027, -0.001082, 0.999999],
    p: [0, 0.055485, 0],
    world: [0.00138, 0.55912, -0.00839],
  },
  {
    name: "neck",
    parent: "Spine",
    q: [0, 0, 0, 1],
    p: [0, 0.056326, 0],
    world: [0.00202, 0.61537, -0.01135],
  },
  {
    name: "Head",
    parent: "neck",
    q: [0.053096, -0.010018, -0.011163, 0.998477],
    p: [0, 0.075748, 0],
    world: [0.00288, 0.69101, -0.01532],
  },
  {
    name: "LeftShoulder",
    parent: "Spine",
    q: [-0.540221, -0.426228, -0.443328, 0.574414],
    p: [0.029552, 0.017363, -0.000379],
    world: [0.03113, 0.57612, -0.00934],
  },
  {
    name: "LeftArm",
    parent: "LeftShoulder",
    q: [0.107497, -0.630382, 0.33809, -0.690477],
    p: [0, 0.119722, 0],
    world: [0.14757, 0.57612, -0.03719],
  },
  {
    name: "LeftForeArm",
    parent: "LeftArm",
    q: [-0.037456, 0.087883, 0.043978, 0.994454],
    p: [0, 0.16243, 0],
    world: [0.27828, 0.48275, -0.01314],
  },
  {
    name: "LeftHand",
    parent: "LeftForeArm",
    q: [-0.078402, -0.160754, -0.130316, -0.975207],
    p: [0, 0.134336, 0],
    world: [0.3936, 0.4145, -0.00368],
  },
  {
    name: "RightShoulder",
    parent: "Spine",
    q: [-0.548504, 0.415515, 0.444417, 0.573571],
    p: [-0.030816, 0.016671, 0.000395],
    world: [-0.02925, 0.57612, -0.00922],
  },
  {
    name: "RightArm",
    parent: "RightShoulder",
    q: [-0.079289, -0.622768, 0.369964, 0.684836],
    p: [0, 0.129917, 0],
    world: [-0.15432, 0.57612, -0.04438],
  },
  {
    name: "RightForeArm",
    parent: "RightArm",
    q: [-0.065715, -0.088695, -0.04479, 0.992879],
    p: [0, 0.163932, 0],
    world: [-0.28504, 0.48275, -0.0117],
  },
  {
    name: "RightHand",
    parent: "RightForeArm",
    q: [0.076133, -0.157893, -0.127988, 0.976162],
    p: [0, 0.134265, 0],
    world: [-0.40032, 0.4145, -0.00285],
  },
  {
    name: "LeftUpLeg",
    parent: "Hips",
    q: [0.957685, 0.198685, 0.200595, 0.055899],
    p: [0.084696, -0.03882, -0.002819],
    world: [0.08423, 0.35651, 0.00017],
  },
  {
    name: "LeftLeg",
    parent: "LeftUpLeg",
    q: [0.238221, -0.165922, 0.230901, 0.928658],
    p: [0, 0.174907, 0],
    world: [0.14511, 0.1979, 0.04176],
  },
  {
    name: "LeftFoot",
    parent: "LeftLeg",
    q: [-0.454768, 0.002314, -0.001198, 0.890606],
    p: [0, 0.14486, 0],
    world: [0.1445, 0.06081, -0.00503],
  },
  {
    name: "LeftToeBase",
    parent: "LeftFoot",
    q: [-0.075098, 0.88484, -0.458156, -0.038885],
    p: [0, 0.052129, 0],
    world: [0.1445, 0.01824, 0.02505],
  },
  {
    name: "RightUpLeg",
    parent: "Hips",
    q: [0.953109, -0.200517, -0.220108, 0.054123],
    p: [-0.086407, -0.040393, -0.001327],
    world: [-0.08688, 0.35651, 0.00017],
  },
  {
    name: "RightLeg",
    parent: "RightUpLeg",
    q: [0.232778, 0.175073, -0.244152, 0.924961],
    p: [0, 0.176378, 0],
    world: [-0.15187, 0.1979, 0.04176],
  },
  {
    name: "RightFoot",
    parent: "RightLeg",
    q: [-0.449468, 0.059055, -0.084721, 0.887307],
    p: [0, 0.144943, 0],
    world: [-0.15125, 0.06081, -0.00529],
  },
  {
    name: "RightToeBase",
    parent: "RightFoot",
    q: [0.132591, 0.871213, -0.439588, 0.173692],
    p: [0, 0.052426, 0],
    world: [-0.14615, 0.01824, 0.02488],
  },
];

export const DOLL_HEIGHT = 1.7;

/** The planted foot goes back at this speed (file units per second) when `walk` plays at rate 1. */
export const WALK_SPEED = 0.5418;
export const WALK_SECONDS = 1.0333;

export const FACE_POINTS = {
  eyeRed: [-0.181, 0.884],
  eyeBlue: [0.2015, 0.912],
  mouth: [0.005, 0.757],
  browY: 1.005,
  chinY: 0.7,
} as const;
