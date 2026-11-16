/**
 * The About page's own files. They are made by `scripts/about/` (the drone by `drone/build.cjs`,
 * the reel by `reel.py`): change the script and run it, never the files. The byte counts are the
 * real sizes, for the loading bar.
 */

/** The drone: a rigged model of ten bones, unlit, with its two pictures inside. */
export const DRONE_MODEL = "/models/about/drone.glb";
export const DRONE_MODEL_BYTES = 250_192;

/** The drone as a still picture, for a browser that cannot draw the scene. */
export const DRONE_STILL = "/img/about/drone.webp";

/** The reel: a muted loop cut from the official films of the five phases, in two sizes. */
const REEL_LARGE = "/video/about/reel-1920.mp4";
const REEL_LARGE_BYTES = 8_460_783;
const REEL_SMALL = "/video/about/reel-1280.mp4";
const REEL_SMALL_BYTES = 4_795_108;
export const REEL_POSTER = "/video/about/reel-poster.webp";

/** Below this display width the small reel is played. The width is all that is looked at. */
const REEL_SMALL_BELOW = 700;

export function pickReel(width: number): { src: string; bytes: number } {
  return width < REEL_SMALL_BELOW
    ? { src: REEL_SMALL, bytes: REEL_SMALL_BYTES }
    : { src: REEL_LARGE, bytes: REEL_LARGE_BYTES };
}
