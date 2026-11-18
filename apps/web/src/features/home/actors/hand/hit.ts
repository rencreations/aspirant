/**
 * Where the pointer is on the hand, in the stage's pixels. A hit is a disc (the palm) and capsules
 * (the fingers), never a ray against the skinned mesh. The depth that comes back is what the kernel
 * sorts on (the smaller is nearer).
 */

/** The distance from a point to a segment. */
export function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 1e-9 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** One finger as the pointer sees it: a segment from the knuckle to the tip, and a radius. */
interface Capsule {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  r: number;
}

/** The palm (a disc) and the five fingers (thumb to pinky). Filled by the actor each frame. */
export interface HandShape {
  palmX: number;
  palmY: number;
  palmR: number;
  fingers: Capsule[];
  /** The depth of a hit: the world z of the palm turned into a distance (smaller is nearer). */
  depth: number;
}

export function makeShape(): HandShape {
  const fingers: Capsule[] = [];
  for (let i = 0; i < 5; i += 1) fingers.push({ ax: 0, ay: 0, bx: 0, by: 0, r: 0 });
  return { palmX: 0, palmY: 0, palmR: 0, fingers, depth: 1000 };
}

/** Is the point on the palm or on a finger? */
export function onHand(shape: HandShape, x: number, y: number): boolean {
  if (Math.hypot(x - shape.palmX, y - shape.palmY) <= shape.palmR) return true;
  for (const f of shape.fingers) {
    if (distToSegment(x, y, f.ax, f.ay, f.bx, f.by) <= f.r) return true;
  }
  return false;
}

/** The depth to report for a hit (`shape.depth` plus a bias that lets a doll on the palm win), or null. */
export function handHit(shape: HandShape, x: number, y: number, bias: number): number | null {
  return onHand(shape, x, y) ? shape.depth + bias : null;
}
