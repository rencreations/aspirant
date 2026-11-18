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

/**
 * The look: the anime recipe of the shared toon system (`../shared/toon.ts`), one for every screen.
 * Black leather does not show a shade that is only the colour times a tint, so the dark texels are
 * lifted to a violet black first (`lift`, linear): the lit step is a dark slate violet, the shade a
 * saturated blue, the core a deep indigo. A hard glint shape sits on the leather and a crisp violet
 * rim on the edge, and the claws and the gold of the bracer are drawn as flat bright colour.
 */
export const LOOK = {
  /** The leather's bands (`ToonLookSpec` numbers). The rim is the glove's own (below). */
  leather: {
    bands: 3,
    cut: [-0.2, 0.12],
    soft: 0.04,
    shade: [0.42, 0.5, 1.0],
    deep: [0.2, 0.26, 0.85],
    lit: [1, 1, 1],
    sat: 1.3,
    rim: 0,
    rimWidth: 0.3,
    glint: 0.6,
    glintSize: 0.978,
  },
  /** What the dark texels of the picture are raised by (linear): a violet black. */
  lift: [0.02, 0.018, 0.05],
  /** The crisp rim: its colour, its strength and the share of the radius it covers. */
  rim: [0.66, 0.5, 1.0],
  rimStrength: 0.95,
  rimWidth: 0.3,
  /** The claws: how bright the flat colour is, and how much of the band shading is kept under it. */
  clawFlat: 1.3,
  clawKeep: 0.3,
  /** The colour of a claw (linear): a bright violet. */
  clawColor: [0.42, 0.22, 0.95],
  /** Where a claw starts on a fingertip bone, as shares of the bone's reach (`claws.ts`): a soft edge from `from` to `to`. */
  clawFrom: 0.34,
  clawTo: 0.44,
} as const;

/**
 * The soft fade at the foot of the screen, in normalised device y (-1 is the bottom edge). The
 * material is opaque above `hi` and gone at `lo`, so the cut at the end of the sleeve can never
 * show, and a hand that sinks dissolves from its lowest part upward.
 */
export const FADE = { lo: -1.0, hi: -0.84 } as const;
