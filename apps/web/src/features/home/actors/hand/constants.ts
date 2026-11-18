/**
 * Names and numbers of Selena's hand. The bone names are the ones three.js gives (spaces become
 * underscores). `public/models/home/hand.facts.json` has the measurements these come from, and
 * `constants.test.ts` keeps the two equal.
 */

export const HAND_MODEL = "/models/home/hand.glb";
/** The model's size on disk, for the loading list. */
export const HAND_MODEL_BYTES = 273_096;

/** The two baked clips: the reach (flat hand to open palm, 1 s) and the breath (4 s loop). */
export const CLIP = { reach: "palm_up", breath: "breath" } as const;
export const REACH_SECONDS = 1;
export const BREATH_SECONDS = 4;

export const BONE = {
  hand: "Bip001_L_Hand",
  forearm: "Bip001_L_Forearm",
  bracer: "Bone01_JianJia_L_03",
} as const;

/**
 * The elbow camera of the notes (`view.camera` of the facts), in the hand's own space: the wrist is
 * the origin, the forearm lies along +Z toward the camera and the fingers point to -Z. The page
 * looks at the hand as if from the visitor's own elbow, behind and above the wrist.
 */
export const ELBOW = {
  position: [0, 0.16, 0.26],
  target: [0, 0.05, -0.24],
} as const;

/**
 * The palm. `offset` is where a thing laid on the palm sits, in the frame of `BONE.hand` (the
 * palm's surface at the end of the reach); `radius` is a little more than half the knuckle to
 * knuckle span (5.2 cm) so a hit and a doll's feet have room.
 */
export const PALM = {
  offset: [0.0391, 0.0171, 0.0218],
  normal: [-0.091, 0.937, 0.338],
  radius: 0.031,
  span: 0.0522,
  length: 0.0799,
} as const;

/** Per finger hit radius around the line from the knuckle to the claw tip, in metres. */
export const FINGER_HIT_RADIUS = 0.017;

/** The look: one recipe for every screen. */
export const LOOK = {
  /** The three light steps of the toon ramp. */
  steps: [64, 150, 255],
  /** A cool rim, a violet fill. */
  rim: [0.62, 0.55, 1.0] as const,
  rimStrength: 0.55,
  ink: 0x120c1c,
  /** The ink's width on the screen, in CSS pixels. */
  inkPx: 2.2,
  /** The glove's gloss: the highlight's tightness and its strength. */
  gloss: 70,
  glossStrength: 0.3,
  /** The claws are lit from within: how much of their own colour is added. */
  clawGlow: 0.55,
} as const;

/**
 * The soft fade at the foot of the screen, in normalised device y (-1 is the bottom edge). The
 * material is opaque above `hi` and gone at `lo`, so the cut at the end of the sleeve can never
 * show, and a hand that sinks dissolves from its lowest part upward.
 */
export const FADE = { lo: -1.0, hi: -0.84 } as const;
