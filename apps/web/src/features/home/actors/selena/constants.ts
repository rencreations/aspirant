/**
 * Names and numbers of Selena's actor. The bone names are the ones three.js gives (spaces become
 * underscores); `public/models/home/selena.facts.json` has the measurements these come from.
 */
import type { ClipName } from "./player";

/** Round seven's file: the six clips (idle to pose and the out clip are new). */
export const SELENA_MODEL = "/models/home/selena-r7.glb";
export const SELENA_CAMERAS = "/models/home/cameras.json";
/** Round seven: the cameras fitted to the recording, with the sky's orientation (`camera-r7.ts`). */
export const SELENA_CAMERAS_R7 = "/models/home/cameras-r7.json";
/** The model's size on disk, for the loading list. */
export const SELENA_MODEL_BYTES = 1_984_760;

export const CLIP = {
  idle: "city_idle",
  hands: "city_interaction_R_loop",
  release: "city_interaction_back_R",
  /** Idle to pose. */
  poseIn: "city_interaction_R",
  /** The character's own out clip (its camera is `cam_city_intercation02`). */
  out: "city_intercation02",
  fall: "city_intercation03",
} as const satisfies Record<string, ClipName>;

export const CLIP_NAMES: readonly ClipName[] = [
  CLIP.idle,
  CLIP.hands,
  CLIP.release,
  CLIP.poseIn,
  CLIP.out,
  CLIP.fall,
];

/** Cross fade lengths (seconds) at the seams the notes measured. */
export const FADE = {
  /** Idle, hands and the way back: the bone heads agree within 4 cm, a short fade hides it. */
  between: 0.18,
  /** The way out of the hands loop: 1.5 cm apart. */
  intoRelease: 0.08,
  /** `back_R` into idle: 3.7 cm. */
  intoIdle: 0.15,
} as const;

export const BONE = {
  head: "Bip001_Head",
  neck: "Bip001_Neck",
  pelvis: "Bip001_Pelvis",
  eyeL: "Bone01_Eye_L_02",
  eyeR: "Bone01_Eye_R_02",
  mouth: "Bone01_Mouth_01",
  handL: "Bip001_L_Hand",
  handR: "Bip001_R_Hand",
  footL: "Bip001_L_Foot",
  footR: "Bip001_R_Foot",
} as const;

/**
 * Where the doll hangs over her right hand in `city_intercation03` (cameras.facts.json): the
 * hand's position in the model's own space plus `hover`, from `from` to `hold` seconds, then
 * blended to plus `drift` by `driftTo`. The offsets are in the model's space (Y up), not in the
 * bone's frame, so the socket is a child of the model, moved every frame.
 */
export const DOLL_ANCHOR = {
  hover: [-0.06, 0.27, 0],
  drift: [-0.38, 0.28, 0],
  from: 1.2,
  hold: 2.8,
  driftTo: 3.2,
  visible: [1.6, 3.4],
} as const;

/** Where the cameras were baked and how the recording was framed (cameras.facts.json). */
export const BAKED = {
  fps: 30,
  vfovDeg: 61.9275,
  /** The recording shows the bottom 80 percent of the 16:9 frame. */
  band: 0.8,
  aspect: 16 / 9,
  /** Silverbolt's pass (cameras.facts.json): in frame, closest, out. */
  pass: { inAt: 1.104, closest: 3.729, outAt: 3.896 },
} as const;

/**
 * How she is measured (`SelenaActor.measure` in the lab wrote these, in metres, in her own space).
 * `place` puts `ANCHOR` (near her pelvis, so the lying and the standing pose turn about one point)
 * at the screen point it is given, and `height` pixels stand for `REF_HEIGHT` metres of her. A pose
 * has a fit box (centre and size) for `frameFor`: the hands at the mouth is her body without the
 * far claws, so a portrait frame crops them; the idle is the whole skin, hair and chain included.
 */
export const ANCHOR = [-0.2, 0.83, 0] as const;
export const REF_HEIGHT = 1.85;
export const POSE_FIT = {
  hands: { cx: -0.14, cy: 0.78, w: 1.1, h: 1.78 },
  idle: { cx: -0.21, cy: 0.88, w: 2.3, h: 1.88 },
} as const;
export type PoseFitName = keyof typeof POSE_FIT;
