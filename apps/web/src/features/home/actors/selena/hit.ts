/**
 * Where the pointer is on her, in the screen's own pixels. A hit target is a disc or a capsule
 * (a segment with a radius) around projected bone points, never a ray against the skinned mesh.
 * The depth that comes back is what the kernel sorts on (the smaller one is nearer); a bias makes
 * the small parts (a hand, the head) win over the large ones (the body) where they overlap.
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

/** `depth + bias` when the point is inside the capsule, else null. A disc has both ends equal. */
export function capsuleHit(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  radius: number,
  depth: number,
  bias: number,
): number | null {
  return distToSegment(px, py, ax, ay, bx, by) <= radius ? depth + bias : null;
}
