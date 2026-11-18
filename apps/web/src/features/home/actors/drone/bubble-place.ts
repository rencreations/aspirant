/**
 * Where the speech bubble goes. The bubble's pivot is the tip of its tail: the tail points at the
 * drone's head and the body of the bubble stands up and out from it. Pure arithmetic in the stage
 * frame (middle origin, y UP), so it can be tested and so a bubble never leaves the screen.
 *
 *  - It is on the right of the head, or on the left when the right has no room (and it keeps the
 *    side it had until that side runs out, so it does not flip back and forth).
 *  - It is above the head. With no room above (the drone is at the top of the screen) it stands
 *    beside the head instead, so the face stays clear.
 *  - It is at least a little inside every edge.
 */

/** Where the bubble's tail tip is in its picture, from the top left, in parts of its size. */
export const TIP_U = 34 / 256;
export const TIP_V = 244 / 256;

/** How far the bubble's body reaches past its pivot, across and up, in parts of its size. */
const REACH_ACROSS = 1 - TIP_U;
const REACH_UP = TIP_V;
/** The bubble keeps this far from the edge of the screen, in pixels. */
const MARGIN = 8;
/** The drone is this many of its heights from the pivot, sideways and up, when the bubble is over the head. */
const OVER_X = 0.18;
const OVER_Y = 0.46;
/** And this many sideways, and up, when it stands beside the head. */
const BESIDE_X = 0.52;
const BESIDE_Y = 0.1;

export interface BubblePlace {
  /** 1: the body of the bubble is on the right of the pivot, -1: on the left. */
  side: number;
  x: number;
  y: number;
}

/** The bubble's size (the width of its picture) for a drone `height` tall, in pixels. */
export function bubbleSize(height: number): number {
  return Math.min(300, Math.max(60, height * 0.78));
}

/**
 * `fx`, `fy` is the middle of the drone and `height` how tall it is; `lift` how far the bubble has
 * drifted up, in sizes of the bubble; `side` the side it had; `width` and `screenHeight` the screen.
 */
export function placeBubble(
  fx: number,
  fy: number,
  height: number,
  lift: number,
  side: number,
  width: number,
  screenHeight: number,
  out: BubblePlace,
): BubblePlace {
  const size = bubbleSize(height);
  const reach = (REACH_ACROSS - 0.5) * size + 0.5 * size;
  const room = width / 2 - MARGIN;

  // Over the head, unless the body of the bubble would pass the top of the screen: then beside it.
  let y = fy + OVER_Y * height + lift * size;
  const top = screenHeight / 2 - MARGIN - REACH_UP * size;
  const beside = y > top;
  if (beside) y = Math.min(fy + BESIDE_Y * height, top);
  const offset = (beside ? BESIDE_X : OVER_X) * height;

  // The side with room for the whole bubble; the one it had when both have.
  let s = side < 0 ? -1 : 1;
  if (s > 0 && fx + offset + reach > room) s = -1;
  else if (s < 0 && fx - offset - reach < -room) s = 1;
  const x = Math.max(-room + 0.2 * size, Math.min(room - 0.2 * size, fx + s * offset));
  out.side = s;
  out.x = x;
  out.y = y;
  return out;
}
