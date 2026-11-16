/**
 * Numbers the parts of the About page share. The film's track is laid out from them in CSS and the
 * drone's path is computed from them, so the two cannot disagree.
 */

/** Scroll, in screens, over which the reel's small preview grows into the big window. */
export const MORPH_SCREENS = 0.9;

/** Scroll, in screens, for which the big window then stands still before the page moves on. */
export const HOLD_SCREENS = 0.8;

/** The film's track, in screens: the first screen, the morph and the hold. */
export const TRACK_SCREENS = 1 + MORPH_SCREENS + HOLD_SCREENS;

/** The shape of the reel, the preview and the big window: the trailers' own 1920 by 810. */
export const REEL_ASPECT = 1920 / 810;

/**
 * Layers inside the page, all under the site's bar and frame. Text is at the bottom, the drone
 * flies over it, and the film's window is over the drone, so the drone passes behind the film.
 * `cover` is TheMLabel's stage at the end of the page: it closes over everything, the drone too
 * (the drone's layer goes up to 4 when it passes in front of the film).
 */
export const LAYER = { text: 1, drone: 2, film: 3, cover: 6 } as const;
