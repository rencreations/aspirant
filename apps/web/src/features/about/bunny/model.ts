/**
 * Facts of Mr. Bunny's model (Chang'e's drone) that the page needs before it has the file and
 * while it poses it. No three here. The file is made by `scripts/about/bunny/build.cjs`: change
 * the script and run it, never the file. The byte count is the real size.
 */
export const BUNNY_MODEL = "/models/about/bunny.glb";
export const BUNNY_MODEL_BYTES = 268_204;

/** The bones, in the skin's order. `body` is the root, at the middle of the body's box. */
export const BUNNY_BONES = [
  "body",
  "ear_L_1",
  "ear_L_2",
  "ear_L_3",
  "ear_R_1",
  "ear_R_2",
  "ear_R_3",
  "foot_L",
  "foot_R",
] as const;

/** The morph targets, in the file's order. Both meshes have all of them. */
export const BUNNY_TARGETS = [
  "squash",
  "stretch",
  "puff",
  "lean_L",
  "lean_R",
  "brow_down",
  "brow_up",
  "pods_out",
  "lens_out",
  "ear_L_droop",
  "ear_R_droop",
  "ear_L_fold",
  "ear_R_fold",
  "ear_L_perk",
  "ear_R_perk",
  "ear_L_curl",
  "ear_R_curl",
] as const;

/**
 * The targets that reshape the whole body. Under them the ears and the feet ride on their hinges:
 * the root's extras (`hinges`) say how far each hinge moves and how the shell turns there at full
 * weight, and the page moves the bone by that (scripts/about/bunny/README.md, "Body targets and
 * the bones").
 */
export const BUNNY_BODY_TARGETS = ["squash", "stretch", "puff", "lean_L", "lean_R"] as const;
