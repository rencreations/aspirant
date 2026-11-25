/**
 * The About page's own files. They are made by `scripts/about/` (the drone by `drone/build.cjs`,
 * the loop of the first screen by `start.py`): change the script and run it, never the files. The byte counts are the
 * real sizes, for the loading bar.
 */

/** The drone: a rigged model of ten bones, unlit, with its two pictures inside. */
export const DRONE_MODEL = "/models/about/drone.glb";
export const DRONE_MODEL_BYTES = 250_192;

/**
 * The Obsidia doll who rides the drone in the fifth phase: the home's own model, the same file at
 * the same address (`features/home/actors/doll/preload.ts` names it there; a test keeps the two
 * equal). It is read here so this page's list never loads the home's pose code to learn its name.
 */
export const DOLL_MODEL = "/models/home/doll.glb";
export const DOLL_MODEL_BYTES = 1_132_208;

/** The drone as a still picture, for a browser that cannot draw the scene. */
export const DRONE_STILL = "/img/about/drone.webp";

/**
 * How it started: a muted loop cut from the studio's own film about the first Aspirant ideas, in
 * two sizes. The whole film, with sound, is the collection's file and is opened by the play control.
 */
const START_LARGE = "/video/about/start-1920.mp4";
const START_LARGE_BYTES = 6_196_986;
const START_SMALL = "/video/about/start-1280.mp4";
const START_SMALL_BYTES = 3_482_943;
export const START_POSTER = "/video/about/start-poster.webp";

/** TheMLabel's own mark, set into the description of the first screen. 720 by 184. */
export const THEMLABEL_LOGO = "/img/about/themlabel.webp";

/** Below this display width the small loop is played. The width is all that is looked at. */
const START_SMALL_BELOW = 700;

export function pickStart(width: number): { src: string; bytes: number } {
  return width < START_SMALL_BELOW
    ? { src: START_SMALL, bytes: START_SMALL_BYTES }
    : { src: START_LARGE, bytes: START_LARGE_BYTES };
}
