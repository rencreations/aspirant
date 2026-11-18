/**
 * The numbers of the gramophone model (`public/models/home/gramophone.glb`, made by
 * `scripts/home/models/gramophone/build.cjs`). They are copied from `gramophone-rig.json`, and
 * `facts.test.ts` reads that file and fails when a number here drifts from it. Plain data only:
 * the loading list imports this file, so no three.js here.
 *
 * Frame of the file: metres, Y up, floor at y 0, the cabinet centred on the Y axis. The horn points
 * +X (tilted 19.4 degrees up), the crank is on the -Z face, the tonearm's post is on -X.
 */
export const GR_NAME = "gramophone";
export const GR_MODEL = "/models/home/gramophone.glb";
export const GR_MODEL_BYTES = 788_884;

/** Height of the model's box. `place({ height })` is the on-screen height of this box. */
export const GR_HEIGHT_M = 0.5322260856628418;

/**
 * The root yaw that puts the horn on the left of the screen, the crank on the right face and the
 * platter in view (the owner's screenshot). The horn is +X, so a yaw of PI is exactly screen left.
 */
export const PRESENT_YAW = 3.84;
/**
 * The view `place` starts from: the rig's yaw turned a little toward the screen (3.6 is 206 degrees,
 * inside the rig's 205 to 235) and tipped 29 degrees toward the camera, so the horn is up at the
 * left and the whole platter and the crank show, as in the owner's screenshot. At the rig's own
 * 3.84 the bell comes forward and covers half the platter.
 */
export const PRESENT_VIEW = { yaw: 3.6, pitch: 0.5 } as const;

export const NODE = {
  root: "gramophone",
  crank: "crank",
  platter: "platter",
  soundbox: "soundbox",
  handle: "anchor_crank_handle",
  seat: "anchor_record_seat",
  needle: "anchor_needle_tip",
  bell: "anchor_bell_mouth",
  elbow: "anchor_elbow",
} as const;

export const CRANK = {
  /** The pivot, in the model's frame. The axis is +Z. */
  pivot: [-0.092, 0.104, -0.141],
  /** The handle's circle: its radius about the axis and its offset along the axis from the pivot. */
  throwRadius: 0.06,
  handleZ: -0.058,
} as const;

export const PLATTER = {
  pivot: [0, 0.148, 0],
  radius: 0.14153779524215912,
  recordSeatY: 0.1475,
  recordRadius: 0.14,
} as const;

export const SOUNDBOX = {
  pivot: [-0.081, 0.193, -0.045],
  /** The axis the needle lifts about (not unit length: normalised where it is used). */
  liftAxis: [0.38, 0, 0.93],
  /** 0 is the needle down on the record. */
  liftDegrees: 50,
} as const;

export const BELL = {
  centre: [0.16533, 0.37622, -0.00001],
  across: 0.3311,
  axis: [0.9435, 0.3312, 0],
} as const;

/** Where a drone's glove can take hold to drag the cabinet (model frame, metres). */
export const DRAG_SOCKETS = {
  /** The face under the horn (the +X face). */
  front: [0.1775, 0.075, 0],
  /** The face opposite it (the -X face). */
  back: [-0.1775, 0.075, 0],
  /** The -Z face (the crank's face), on the side away from the crank. */
  side: [0.1, 0.075, -0.1775],
} as const;
