/**
 * Facts of the normal drone for the home: where its files are and how big it is. No three here, so
 * `preload.ts` (which is in the bundle of every page) and the tests can import it.
 *
 * The model is the About page's own file, never changed (`public/models/about/drone.glb`). The two
 * extra face atlases and the icons file (of which only the bang is used) are made by `scripts/home/drone/`.
 */
import { DRONE_MODEL, DRONE_MODEL_BYTES } from "@/features/about/media";
import { BODY_METRES } from "@/features/about/drone/model";

export { BODY_METRES, DRONE_MODEL, DRONE_MODEL_BYTES };

/** The second and third page of faces (the first page is the model's own picture). */
export const FACES_A = "/img/home/drone-faces.webp";
export const FACES_A_BYTES = 21_286;
export const FACES_B = "/img/home/drone-faces-2.webp";
export const FACES_B_BYTES = 12_976;
/** The icons file: six cells on a 576 by 384 picture. The shock mark draws its bang. */
export const MARKS = "/img/home/marks.webp";
export const MARKS_BYTES = 24_700;

/**
 * The model's height at rest, in its metres: the bind pose's box from the file's own accessors
 * (a test reads them). This is what `height` means for the home: the on-screen height of the drone
 * standing upright with its wings at rest.
 */
export const BODY_HEIGHT_METRES = 0.44748;

/**
 * The About page sizes the drone by the width of its anchor, `BODY_METRES` of the model across. One
 * metre of the model is the same number of pixels on both pages when `size = height * SIZE_PER_HEIGHT`,
 * so the two drones match at the same place and attitude.
 */
export const SIZE_PER_HEIGHT = BODY_METRES / BODY_HEIGHT_METRES;

/** The lens of the About drone: narrow, so the drone is drawn almost without perspective. */
export const FOV = 20;
export const DISTANCE = 8;
export const VIEW_HEIGHT = 2 * DISTANCE * Math.tan((FOV * Math.PI) / 360);

/**
 * The same lens in the stage's pixel world (one unit one CSS pixel at z = 0, y up): how far the
 * camera stands from the picture plane so that it shows `stageHeight` pixels with `FOV` degrees.
 * The drone and the doll who rides it are drawn in this world, in one depth buffer (round eight).
 */
export function lensDistance(stageHeight: number): number {
  return Math.max(1, stageHeight) / 2 / Math.tan((FOV * Math.PI) / 360);
}

/** The colours of the drone's own line and of its trail, as on `/about`. */
export const INK = 0x1f2735;
export const CYAN = 0x23d0d8;
