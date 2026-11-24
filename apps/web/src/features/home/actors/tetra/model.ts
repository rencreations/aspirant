/**
 * Facts of Tetra for the home: where her files are and what the numbers mean. No three here, so
 * `preload.ts` (which is in the bundle of every page) and the tests can import it.
 *
 * The model is the About page's own file (`public/models/about/tetra.glb`, never changed).
 */
import {
  CLIP_LIFT,
  TETRA_HEIGHT,
  TETRA_MODEL,
  TETRA_MODEL_BYTES,
  type ClipName,
  type MouthName,
} from "@/features/about/tetra/model";

export { CLIP_LIFT, TETRA_HEIGHT, TETRA_MODEL, TETRA_MODEL_BYTES };
export type { ClipName, MouthName };

export const TETRA_NAME = "tetra";
