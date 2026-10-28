import type { HeroView } from "../../vexana/opening/opening-math";

/** The hero recording is 16:9. */
const VIDEO_AR = 16 / 9;
/** Where her face is in the recording (fractions of its width and height). */
const FACE = { x: 0.61, y: 0.38 };
/** Where the picture is anchored when the screen cuts it (keep in step with `.heroVideo`). */
const ANCHOR = { x: 0.66, y: 0.38 };

/**
 * Where her face sits on screen (fractions of the screen) when the recording fills it the way
 * `object-fit: cover` lays it out. The frame closes onto this point and the picture grows from it.
 */
export function heroFace(vw: number, vh: number): { x: number; y: number } {
  const screenAr = vw / vh;
  if (screenAr < VIDEO_AR) {
    const w = vh * VIDEO_AR;
    return { x: ((vw - w) * ANCHOR.x + FACE.x * w) / vw, y: FACE.y };
  }
  const h = vw / VIDEO_AR;
  return { x: FACE.x, y: ((vh - h) * ANCHOR.y + FACE.y * h) / vh };
}

/**
 * The camera of her opening: a push in toward her face and shoulders while the frame closes into
 * the card (a little further than the plain hero), starting at once with the first scroll.
 */
export function heroView(vw: number, vh: number): HeroView {
  return { face: heroFace(vw, vh), zoom: 1.32, from: 0.03 };
}
