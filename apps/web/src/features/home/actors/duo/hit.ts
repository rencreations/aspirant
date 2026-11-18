/**
 * Where a drone can be touched. Each drone is a few discs on the screen: its ball and its two
 * gloves. A test is a few subtractions, no raycast, so it can run every frame.
 */

/** A disc: the middle and the radius, in stage pixels (y up). */
export interface Disc {
  x: number;
  y: number;
  r: number;
}

export const newDiscs = (n: number): Disc[] =>
  Array.from({ length: n }, () => ({ x: 0, y: 0, r: 0 }));

/** True when the point is inside any disc. */
export function insideAny(discs: readonly Disc[], x: number, y: number): boolean {
  for (const d of discs) {
    if (d.r <= 0) continue;
    const dx = x - d.x;
    const dy = y - d.y;
    if (dx * dx + dy * dy <= d.r * d.r) return true;
  }
  return false;
}

/** A point of the window (client pixels, y down) in the stage's own frame (origin in the middle, y up). */
export function clientToStage(
  cx: number,
  cy: number,
  w: number,
  h: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  out.x = cx - w / 2;
  out.y = h / 2 - cy;
  return out;
}

/** A point of the stage on the screen from a world point of the perspective pass. */
export function project(
  X: number,
  Y: number,
  Z: number,
  distance: number,
  out: { x: number; y: number },
): boolean {
  const k = distance - Z;
  if (k <= 1) return false;
  out.x = (X * distance) / k;
  out.y = (Y * distance) / k;
  return true;
}
