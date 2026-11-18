/**
 * Facts of Tetra for the home: where her files are and what the numbers mean. No three here, so
 * `preload.ts` (which is in the bundle of every page) and the tests can import it.
 *
 * The model is the About page's own file (`public/models/about/tetra.glb`, never changed). The
 * kite and its bows are made by `scripts/home/kite/` (`public/img/home/`).
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

/** The sail of the kite (her own chibi picture) and the strip of three bows for its tail. */
export const KITE = "/img/home/kite.webp";
export const KITE_BYTES = 68_762;
export const KITE_BOWS = "/img/home/kite-bows.webp";
export const KITE_BOWS_BYTES = 6_400;

/** From `kite.json`: the sail's width over its height, and where the string is tied (v from the top). */
export const KITE_ASPECT = 0.73341;
export const KITE_KNOT_V = 0.52;
/** The three bows' cells on the strip, as fractions of its width. */
export const KITE_BOW_CELLS = 3;
