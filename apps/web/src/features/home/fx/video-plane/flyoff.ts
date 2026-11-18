/**
 * The fly-off: the trailer and the ten previews leave to the bottom right on flexible lines, as
 * the 3D object of tibdigital.com's "SINCE 2007" makes way (digest `ref-psychoactive-tib.md` 2.3).
 * Pure functions of the viewport and a progress `f`; reversible; nothing allocates per call.
 *
 * The lines are the digest's four: each is 3 x the screen diagonal long, tilted `-0.5 + angle`
 * radians (about 28 degrees, descending to the right), offset along its normal, and bent by
 * `y += sin(aX pi freq + phase) amp`, so each has about `freq` gentle S curves over its length. An
 * item first leaves its own place for the nearest line, then rides it out of the corner, turning as
 * it goes (a roll, a yaw and a small tumble: the spiral), growing small and far. The set starts with
 * the tail of the orbit and ends with the trailer, so every item is done at `f` = 1. A trail of
 * each item's own path is what shows the line.
 */
import {
  clamp,
  mix,
  qFromEuler,
  qMul,
  ramp,
  seeded,
  smootherstep,
  type Q,
} from "../image-field/math";
import { PLANE_COUNT, type PlanePose, type Vp } from "./types";

/** The digest's table (2.3): where the line stands (in half screens), its tilt, its bend and its phase. */
export const LINES = [
  { y: 0.6, angle: 0.05, amp: 0.3, freq: 1.6, phase: 0 },
  { y: 0.2, angle: 0.05, amp: 0.39, freq: 1.3, phase: 3.1 },
  { y: -0.2, angle: -0.06, amp: 0.27, freq: 2.6, phase: 4.6 },
  { y: -0.6, angle: 0.04, amp: 0.33, freq: 2.1, phase: 1.7 },
] as const;

const BASE_TILT = -0.5;
/** How far back (px of z) an item has gone when it leaves. */
const FLY_DEPTH = 380;
const END_SCALE = 0.32;
/** The share of the fly-off over which the starts of the items are spread. */
export const STAGGER = 0.5;

/** Per item seeds, fixed: the same spiral on every load. */
const rand = seeded(7021);
const SEEDS = Array.from({ length: PLANE_COUNT }, () => ({
  roll: rand(),
  yaw: rand(),
  tumble: rand(),
  side: rand() < 0.5 ? -1 : 1,
}));

/** A point of line `k` at `aX` (-1 to 1 along it), in the stage's frame. Writes `out`. */
export function lineAt(vp: Vp, k: number, aX: number, out: [number, number]): void {
  const line = LINES[k % LINES.length]!;
  const unit = vp.h / 6;
  const half = 0.75 * Math.hypot(vp.w, vp.h);
  const lx = aX * half;
  const ly = Math.sin(aX * Math.PI * line.freq + line.phase) * line.amp * 3 * unit;
  const rz = BASE_TILT + line.angle;
  const c = Math.cos(rz);
  const s = Math.sin(rz);
  const off = line.y * 3 * unit;
  out[0] = lx * c - ly * s - s * off;
  out[1] = lx * s + ly * c + c * off;
}

/** What one item's route needs, made once a frame from where the item is. */
export interface Route {
  line: number;
  p0x: number;
  p0y: number;
  /** Where on its line the item joins it, and where it leaves the screen. */
  a0: number;
  a1: number;
}

export function makeRoute(): Route {
  return { line: 0, p0x: 0, p0y: 0, a0: 0, a1: 1 };
}

/** The line nearest an item, the foot of the perpendicular on it, and the end of the ride. */
export function setupRoute(vp: Vp, bx: number, by: number, margin: number, out: Route): Route {
  const unit = vp.h / 6;
  const half = 0.75 * Math.hypot(vp.w, vp.h);
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k < LINES.length; k++) {
    const rz = BASE_TILT + LINES[k]!.angle;
    const nx = -Math.sin(rz);
    const ny = Math.cos(rz);
    const d = Math.abs(bx * nx + by * ny - LINES[k]!.y * 3 * unit);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  const line = LINES[best]!;
  const rz = BASE_TILT + line.angle;
  const dx = Math.cos(rz);
  const dy = Math.sin(rz);
  const ox = -Math.sin(rz) * line.y * 3 * unit;
  const oy = Math.cos(rz) * line.y * 3 * unit;
  out.line = best;
  out.p0x = bx;
  out.p0y = by;
  out.a0 = ((bx - ox) * dx + (by - oy) * dy) / half;
  // The line leaves the screen's right edge or its bottom edge, whichever it meets first; the item
  // goes on until it is clear of it (its own size and the bend of the line are the margin).
  const reach = Math.abs(line.amp * 3 * unit) + margin;
  const tx = dx > 1e-3 ? (vp.w / 2 + reach - ox) / dx : Infinity;
  const ty = dy < -1e-3 ? (-vp.h / 2 - reach - oy) / dy : Infinity;
  out.a1 = Math.max(out.a0 + 0.2, Math.min(tx, ty) / half);
  return out;
}

const point: [number, number] = [0, 0];

/** The item's centre at the progress `u` of its ride (0 its own place, 1 clear of the screen). */
export function routeAt(vp: Vp, r: Route, u: number, out: [number, number]): void {
  const t = smootherstep(u);
  const aX = mix(r.a0, r.a1, t);
  lineAt(vp, r.line, aX, point);
  const join = smootherstep(ramp(u, 0, 0.5));
  out[0] = mix(r.p0x, point[0], join);
  out[1] = mix(r.p0y, point[1], join);
}

/** The place of an item in the order of leaving: the tail of the orbit first, the trailer last (0 to 1). */
export function leaveRank(a: number): number {
  return 1 - a;
}

/** One item's own progress for the set's `f`: its start is its rank of the spread, and it ends at `f` = 1. */
export function itemProgress(f: number, rank: number): number {
  return clamp((f - rank * STAGGER) / (1 - STAGGER));
}

const route = makeRoute();
const spot: [number, number] = [0, 0];
const qa: Q = [0, 0, 0, 1];
const qb: Q = [0, 0, 0, 1];

/**
 * The pose of item `k` at the set's progress `f`, from where it stood (`base`). `a` is its place
 * in the orbit's train (0 the leader). At `f` = 0 it is `base`; at `f` = 1 it is gone.
 */
export function flyPose(
  vp: Vp,
  k: number,
  a: number,
  base: PlanePose,
  f: number,
  out: PlanePose,
): PlanePose {
  const rank = leaveRank(a);
  const u = itemProgress(f, rank);
  if (u <= 0) {
    out.x = base.x;
    out.y = base.y;
    out.z = base.z;
    out.q[0] = base.q[0];
    out.q[1] = base.q[1];
    out.q[2] = base.q[2];
    out.q[3] = base.q[3];
    out.w = base.w;
    out.h = base.h;
    out.corner = base.corner;
    out.opacity = base.opacity;
    out.order = base.order;
    out.bend = 0;
    out.flutter = 0;
    return out;
  }
  const seed = SEEDS[k % PLANE_COUNT]!;
  setupRoute(vp, base.x, base.y, Math.hypot(base.w, base.h) * 0.8, route);
  routeAt(vp, route, u, spot);
  const shrink = mix(1, END_SCALE, smootherstep(ramp(u, 0.08, 1)));

  // The spiral: a roll in the screen's plane, a yaw about the item's own vertical axis, a small tumble.
  const roll = seed.side * (0.5 + 0.7 * seed.roll) * Math.PI * smootherstep(u);
  const yaw = seed.side * (0.9 + 1.1 * seed.yaw) * Math.PI * smootherstep(u);
  const tumble = Math.sin(Math.PI * u) * (0.35 + 0.35 * seed.tumble) * -seed.side;
  qFromEuler(tumble, yaw, roll, qa);
  qMul(qa, base.q, qb);

  out.x = spot[0];
  out.y = spot[1];
  out.z = base.z - FLY_DEPTH * smootherstep(u);
  out.q[0] = qb[0];
  out.q[1] = qb[1];
  out.q[2] = qb[2];
  out.q[3] = qb[3];
  out.w = base.w * shrink;
  out.h = base.h * shrink;
  out.corner = base.corner * shrink;
  out.opacity = base.opacity * (1 - smootherstep(ramp(u, 0.82, 1)));
  out.order = base.order;
  out.bend = 0.5 * Math.sin(Math.PI * u) * seed.side;
  out.flutter = 0.04 * base.h * Math.sin(Math.PI * u);
  return out;
}

/** How many points a trail has. */
export const TRAIL_POINTS = 28;
/** How much of the ride a trail covers. */
const TRAIL_SPAN = 0.34;

/**
 * Write the trail of item `k` (its own path, behind its centre) as `TRAIL_POINTS` pairs of x, y into
 * `out` from `at`, the head first, and return how many points are real (0 when the item has not
 * started or is gone).
 */
export function trailOf(
  vp: Vp,
  a: number,
  base: PlanePose,
  f: number,
  out: Float32Array,
  at: number,
): number {
  const u = itemProgress(f, leaveRank(a));
  if (u <= 0.004 || u >= 0.995) return 0;
  setupRoute(vp, base.x, base.y, Math.hypot(base.w, base.h) * 0.8, route);
  const span = Math.min(u, TRAIL_SPAN);
  for (let j = 0; j < TRAIL_POINTS; j++) {
    routeAt(vp, route, u - (span * j) / (TRAIL_POINTS - 1), spot);
    out[at + j * 2] = spot[0];
    out[at + j * 2 + 1] = spot[1];
  }
  return TRAIL_POINTS;
}
