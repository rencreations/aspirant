/**
 * Two helpers for a section that places the drone: "beside a point" and "along a path". Both work
 * in the stage frame (middle origin, y up) and return a place for `DroneActor.place`. The drone's
 * own springs and its nose-first attitude do the rest, so a section only moves a point. No three here.
 */
import type { DronePlace } from "./coords";

export interface PathPoint {
  x: number;
  y: number;
  /** The drone's on-screen height at this point. */
  height: number;
}

export type Side = "left" | "right" | "above" | "below";

/** The distance from a point to the drone's middle, in drone heights, when the gap is 0. */
const HALF_BODY = 0.5;

/**
 * The drone stands beside `point`, a `gap` (in drone heights) clear of it, and looks at it: a drone
 * on the left faces right, one above looks down. The result is a place.
 */
export function besidePoint(
  point: { x: number; y: number },
  side: Side,
  height: number,
  out: DronePlace,
  gap = 0.25,
): DronePlace {
  const d = height * (HALF_BODY + gap);
  out.x = point.x;
  out.y = point.y;
  out.z = 0;
  out.height = height;
  out.yaw = 0;
  out.pitch = 0;
  out.roll = 0;
  if (side === "left") {
    out.x -= d;
    out.yaw = 0.45;
  } else if (side === "right") {
    out.x += d;
    out.yaw = -0.45;
  } else if (side === "above") {
    out.y += d;
    out.pitch = 0.22;
  } else {
    out.y -= d;
    out.pitch = -0.22;
  }
  return out;
}

/** A point of a smooth curve: Catmull-Rom between the middle two of four. */
function spline(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * u +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
  );
}

/**
 * The place at `progress` (0 to 1) along a smooth curve through `points`. The parameter follows the
 * length of the line between the points, so the same step of progress is about the same distance
 * anywhere on it, and the curve passes through every point. The height goes from point to point.
 * Outside 0 to 1 it stays at the ends, so a section may pass any scroll fraction in.
 */
export function alongPath(
  points: readonly PathPoint[],
  progress: number,
  out: PathPoint,
): PathPoint {
  const count = points.length;
  const first = points[0];
  const last = points[count - 1];
  if (!first || !last) {
    out.x = 0;
    out.y = 0;
    out.height = 100;
    return out;
  }
  if (count === 1 || progress <= 0) return copy(first, out);
  if (progress >= 1) return copy(last, out);

  let total = 0;
  for (let i = 0; i < count - 1; i += 1) total += lengthOf(points, i);
  if (total <= 0) return copy(first, out);
  let want = progress * total;
  for (let i = 0; i < count - 1; i += 1) {
    const len = lengthOf(points, i);
    if (want <= len || i === count - 2) {
      const u = len > 0 ? Math.min(1, want / len) : 0;
      const p0 = points[Math.max(0, i - 1)] ?? first;
      const p1 = points[i] ?? first;
      const p2 = points[i + 1] ?? last;
      const p3 = points[Math.min(count - 1, i + 2)] ?? last;
      out.x = spline(p0.x, p1.x, p2.x, p3.x, u);
      out.y = spline(p0.y, p1.y, p2.y, p3.y, u);
      out.height = p1.height + (p2.height - p1.height) * u;
      return out;
    }
    want -= len;
  }
  return copy(last, out);
}

function lengthOf(points: readonly PathPoint[], i: number): number {
  const a = points[i];
  const b = points[i + 1];
  return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
}

function copy(p: PathPoint, out: PathPoint): PathPoint {
  out.x = p.x;
  out.y = p.y;
  out.height = p.height;
  return out;
}
