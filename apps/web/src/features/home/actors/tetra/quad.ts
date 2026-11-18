/** A point on the screen in the four corners of a cover, given in order round it (either way). */
export function inQuad(q: ReadonlyArray<{ x: number; y: number }>, x: number, y: number): boolean {
  let side = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    if (!a || !b) return false;
    const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (cross !== 0) {
      const s = cross > 0 ? 1 : -1;
      if (side !== 0 && s !== side) return false;
      side = s;
    }
  }
  return true;
}
