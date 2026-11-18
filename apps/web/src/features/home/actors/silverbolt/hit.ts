/**
 * Hit testing for Silverbolt's parts. A skinned mesh is never raycast: each part is a few capsules
 * between joints, projected to the screen once a frame (in `update`) into a flat cache, and
 * `test(x, y)` only reads the cache. All maths is on the stage's pixel frame (origin in the middle,
 * y up) and on the camera's distance `camZ`, which is how a perspective pixel camera projects.
 */
import { perspectiveFactor } from "./math";

/** Floats per capsule in the cache: ax, ay, bx, by, radius (px), depth a, depth b. */
const STRIDE = 7;

/** The distance from a point to a segment, and where along it the nearest point is (0..1). */
export function segmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  out: { d: number; t: number } = { d: 0, t: 0 },
): { d: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  out.d = Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  out.t = t;
  return out;
}

/** A fixed pool of projected capsules, grouped by part. No allocation after construction. */
export class HitField {
  private readonly data: Float64Array;
  private used = 0;
  private readonly tmp = { d: 0, t: 0 };

  constructor(capacity: number) {
    this.data = new Float64Array(capacity * STRIDE);
  }

  /** Start a frame: forget every capsule. */
  clear(): void {
    this.used = 0;
  }

  /** The cache position of the next capsule: a part notes its start, then adds its capsules. */
  mark(): number {
    return this.used;
  }

  count(start: number): number {
    return this.used - start;
  }

  /**
   * Add a capsule from world point a to world point b (stage units, z toward the camera) with a
   * world radius. The projection happens here.
   */
  add(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    radius: number,
    camZ: number,
  ): void {
    const at = this.used * STRIDE;
    if (at + STRIDE > this.data.length) return;
    const fa = perspectiveFactor(az, camZ);
    const fb = perspectiveFactor(bz, camZ);
    this.data[at] = ax * fa;
    this.data[at + 1] = ay * fa;
    this.data[at + 2] = bx * fb;
    this.data[at + 3] = by * fb;
    this.data[at + 4] = radius * Math.max(fa, fb);
    this.data[at + 5] = camZ - az;
    this.data[at + 6] = camZ - bz;
    this.used += 1;
  }

  /**
   * The depth (distance from the camera, smaller is nearer) of the nearest hit among the part's
   * capsules at a stage point, or null. `bias` is added so that a part can win an overlap.
   */
  test(start: number, count: number, px: number, py: number, bias: number): number | null {
    let best: number | null = null;
    for (let i = start; i < start + count; i++) {
      const at = i * STRIDE;
      const hit = segmentDistance(
        px,
        py,
        this.data[at]!,
        this.data[at + 1]!,
        this.data[at + 2]!,
        this.data[at + 3]!,
        this.tmp,
      );
      if (hit.d > this.data[at + 4]!) continue;
      const a = this.data[at + 5]!;
      const b = this.data[at + 6]!;
      const depth = a + (b - a) * hit.t + bias;
      if (best === null || depth < best) best = depth;
    }
    return best;
  }
}
