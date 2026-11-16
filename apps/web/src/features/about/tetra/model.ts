/**
 * Facts of Tetra's model that the stage (not lazy) and the scene (the lazy chunk) both need. No
 * three here. The file is made by `scripts/about/tetra/build.cjs`: change the script and run it,
 * never the file. The byte count is the real size.
 */
export const TETRA_MODEL = "/models/about/tetra.glb";
export const TETRA_MODEL_BYTES = 573_716;

/** How tall the doll is, in the model's metres, from the ground to the tips of the ears. */
export const TETRA_HEIGHT = 0.649;

/** The clips that are written into the file. */
export type ClipName = "walk" | "hiphop" | "rumba";

/** The mouth's drawings (the targets of the mouth's mesh). One is shown at a time. */
export type MouthName =
  | "mouth_a"
  | "mouth_i"
  | "mouth_u"
  | "mouth_e"
  | "mouth_o"
  | "smile_mouth"
  | "grin"
  | "frown_mouth";

/**
 * How far each clip leaves the ends of the legs above the ground (a negative number: under it), in
 * metres: the lowest point the build measures for the clip (`legTips` in its summary), less the
 * rest pose's 0.012. The scene takes it out of the hips' height, so the feet meet the shadow.
 */
export const CLIP_LIFT: Record<ClipName, number> = {
  walk: 0.008,
  hiphop: -0.006,
  rumba: -0.009,
};
