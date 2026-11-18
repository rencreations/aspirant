/**
 * The arithmetic of the preview window, in plain functions (nothing here touches the page): the
 * transform that takes a picture back to the card it came from, and the wrap of the next and
 * previous buttons.
 */

/** A rectangle in CSS pixels from the top left of the viewport. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The transform (about the box's centre) that puts the picture at `start` when it stands at `end`:
 * a move of the centre and one scale by width. The preview opens by animating it to none and closes
 * by animating it from none, so the picture grows out of its card and goes back into it.
 */
export function flipBetween(start: Box, end: Box): { dx: number; dy: number; scale: number } {
  const scale = start.w / Math.max(1, end.w);
  return {
    dx: start.x + start.w / 2 - (end.x + end.w / 2),
    dy: start.y + start.h / 2 - (end.y + end.h / 2),
    scale,
  };
}

/** The next index after `i` moved by `step` in a list of `n`, wrapping both ways. */
export function wrapIndex(i: number, step: number, n: number): number {
  if (n <= 0) return 0;
  return (((i + step) % n) + n) % n;
}

/** True when the box is on the screen (at least a quarter of it), so a picture can fly back to it. */
export function isOnScreen(box: Box, vw: number, vh: number): boolean {
  const w = Math.max(0, Math.min(box.x + box.w, vw) - Math.max(box.x, 0));
  const h = Math.max(0, Math.min(box.y + box.h, vh) - Math.max(box.y, 0));
  return w * h >= 0.25 * box.w * box.h && box.w > 8 && box.h > 8;
}
