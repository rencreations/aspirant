/**
 * Where the doll is and how big, in the stage's pixel frame, as pure functions. The frame: origin
 * at the middle of the viewport, x right, y up, one unit one CSS pixel at z = 0. The camera of the
 * cast pass is perspective at z = `CAMERA_DISTANCE`, so a thing at depth z is drawn
 * `CAMERA_DISTANCE / (CAMERA_DISTANCE - z)` times larger than at z = 0.
 */
import { DOLL_HEIGHT } from "./rig";

export const CAMERA_DISTANCE = 1000;

/**
 * How big she is drawn, as a share of the height a section asks for (the owner, 19 Nov 2026: "the
 * Obsidia doll are too big"). It is applied once, inside the actor, to every placement, so a section
 * keeps asking for the size it always asked for: `place({ height })`, the fitting under a socket, the
 * hang, the hop and the walk's stride all read it. A section that turns her height into an offset or
 * the size of a mark of her own multiplies by it (`drawnHeight`).
 */
export const DOLL_SIZE = 0.6;

/** The height on the screen of a doll that a section asked to be `height` tall. */
export function drawnHeight(height: number): number {
  return height * DOLL_SIZE;
}
/** Nothing is placed nearer the camera than this share of its distance (the scale would run away). */
const NEAR_LIMIT = 0.9;

/** How much larger a thing at `z` is drawn than at z = 0. */
export function depthScale(z: number): number {
  const nearest = CAMERA_DISTANCE * NEAR_LIMIT;
  return CAMERA_DISTANCE / (CAMERA_DISTANCE - Math.min(z, nearest));
}

/**
 * The scale of the doll's root (the file's 1.7 unit doll to world units) so that she is `height`
 * CSS pixels tall on the screen at depth `z`.
 */
export function rootScale(height: number, z: number): number {
  return height / depthScale(z) / DOLL_HEIGHT;
}

/**
 * The same, under a parent whose own world scale is `parentScale` (a socket of another actor): the
 * local scale that makes her `height` pixels tall on the screen at the parent's depth `z`.
 */
export function fitScale(height: number, z: number, parentScale: number): number {
  return parentScale > 0 ? rootScale(height, z) / parentScale : rootScale(height, z);
}

/** The screen position of a world point (stage pixels) and how much that point is magnified. */
export function projectToStage(
  out: { x: number; y: number; s: number },
  x: number,
  y: number,
  z: number,
): { x: number; y: number; s: number } {
  const s = depthScale(z);
  out.x = x * s;
  out.y = y * s;
  out.s = s;
  return out;
}

/** The depth for a hit: smaller is nearer, so the one with the larger z wins. */
export function hitDepth(z: number): number {
  return CAMERA_DISTANCE - z;
}

/** A point inside a circle. */
export function insideCircle(cx: number, cy: number, r: number, x: number, y: number): boolean {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/** A point inside a capsule (a segment with a radius), the body of a hit test. */
export function insideCapsule(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: number,
  x: number,
  y: number,
): boolean {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * abx + (y - ay) * aby) / len2)) : 0;
  return insideCircle(ax + abx * t, ay + aby * t, r, x, y);
}

/** Client pixels (origin top left) to the stage's frame. */
export function clientToStage(
  out: { x: number; y: number },
  clientX: number,
  clientY: number,
  width: number,
  height: number,
): { x: number; y: number } {
  out.x = clientX - width / 2;
  out.y = height / 2 - clientY;
  return out;
}
