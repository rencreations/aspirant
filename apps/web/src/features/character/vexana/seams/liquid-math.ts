import { seg } from "./scroll-kit";

/**
 * The join between the registry (01) and the film (02), in screens of scrolling. The last screen of
 * the registry is held for `HOLD_SCREENS`. Going down, a white liquid rises over the first
 * `DOWN_SCREENS` of it and covers the page; the film waits under it. Going back up, the film is held
 * stuck for `UP_SCREENS` (the stretch the page jumps over on the way down, so arriving here has no
 * threshold) and a black liquid rises over that stretch.
 */
export const DOWN_SCREENS = 1.36;
export const UP_SCREENS = 0.8;
export const HOLD_SCREENS = DOWN_SCREENS + UP_SCREENS;

/** The share of the hold where the white liquid has covered the page and the black one begins. */
export const DONE = DOWN_SCREENS / HOLD_SCREENS;

/** The share of the old hold (1.7 screens, covered at 0.8) the shapes were timed in. */
const OLD_DONE = 0.8;

/** How far the white liquid has come, 0 to 1, at a progress of the hold. */
export function whiteAt(p: number): number {
  return seg(p, 0, DONE);
}

/** How far the black liquid has come going back up, 0 (the film in place) to 1 (page covered). */
export function blackAt(p: number): number {
  return seg(1 - p, 0, 1 - DONE);
}

/** The progress of the shapes in the units they were timed in (they cover the page at 0.8). */
export function shapeClock(v: number): number {
  return v * OLD_DONE;
}

export type Side = "registry" | "film";

/** How close, in pixels, to the cover point counts as being on it (a snap can stop a pixel short). */
const COVER_PX = 2;

/**
 * Where the page is, from the progress of the hold alone (a reload part way down, a jump by a key):
 * the registry until the white liquid has covered the page, the film from then on. `len` is the
 * length of the hold in pixels, for the tolerance.
 */
export function sideAt(p: number, len = 2000): Side {
  return p >= DONE - COVER_PX / len ? "film" : "registry";
}

/** Whether going back has brought the black liquid all the way over the page. */
export function blackCovers(p: number, len = 2000): boolean {
  return p <= DONE + COVER_PX / len;
}

/**
 * Whether going down has landed where the arrival plays: inside the hold or a little past its end
 * (a wheel, a key press of a page, the smooth scroller catching up). Far beyond is a jump (the End
 * key, a link), and the page is taken as it is.
 */
export function arrivesDown(pa: number): boolean {
  return pa <= 1.35;
}

/** The same going back: inside the hold or a little above its start. Far above is a jump (Home). */
export function arrivesUp(pa: number): boolean {
  return pa >= -0.35;
}
