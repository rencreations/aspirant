/**
 * The fly-off: the trailer and the ten previews leave to the bottom right on flexible lines, as
 * the 3D object of tibdigital.com's "SINCE 2007" makes way (digest `ref-psychoactive-tib.md` 2.3).
 * Pure functions of the viewport and a progress `f`; reversible; nothing allocates per call.
 *
 * The lines are the digest's four: each is 3 x the screen diagonal long, tilted `-0.5 + angle`
 * radians (about 28 degrees, descending to the right), offset along its normal, and bent by
 * `y += sin(aX pi freq + phase) amp`, so each has about `freq` gentle S curves over its length. An
 * item first leaves its own place for the nearest line, then rides it out of the corner, turning as
 * it goes (a roll, a yaw and a small tumble: the spiral), growing small. A trail of each item's own
 * path is what shows the line.
 *
 * Round nine (20 Nov 2026): the whole exit is one steady scroll linked motion. Every item is moving
 * from the first pixel (the trailer too: it used to wait half the exit while the previews went) at a
 * constant speed along its line, with a short ease over the first and last `EASE_EDGE` of its ride and
 * nothing else (the old smootherstep made a slow, fast, slow ride, and the recede in depth slowed the
 * picture on the screen). The tail of the train starts up to `STAGGER` later than the leader, so the
 * set pulls out like a train, and every item is done at `f` = 1.
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
const END_SCALE = 0.32;
/** The share of the fly-off by which the last card of the train starts later than the leader. */
export const STAGGER = 0.12;
/** The share of a ride over which the speed comes up from nothing, and goes down to nothing at the end. */
export const EASE_EDGE = 0.04;
/** The share of a ride in which an item closes the gap between its own place and its line. */
const JOIN_END = 0.6;

/**
 * Where an item is along its ride (0 to 1) at the share `u` of the ride: a straight run at a constant
 * speed with a short ease in and a short ease out (`e` of the ride each). The speed is continuous, so
 * nothing jumps, and the middle is exactly linear: the same distance for the same scroll.
 */
export function steady(u: number, e: number = EASE_EDGE): number {
  const x = clamp(u);
  const k = 1 - e;
  if (x < e) return (0.5 * x * x) / e / k;
  if (x > 1 - e) {
    const t = 1 - x;
    return 1 - (0.5 * t * t) / e / k;
  }
  return (0.5 * e + (x - e)) / k;
}

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

/** How many pieces the path of an item is cut into to measure its length. */
const ARC_STEPS = 96;

/** What one item's route needs, made once a frame from where the item is. */
export interface Route {
  line: number;
  p0x: number;
  p0y: number;
  /** Where on its line the item joins it, and where it leaves the screen. */
  a0: number;
  a1: number;
  /** The length of the path from the item's own place up to each of the `ARC_STEPS` cuts (px). */
  cum: Float64Array;
  /** The length of the ride: from the item's own place to where it is clear of the screen (px). */
  total: number;
}

export function makeRoute(): Route {
  return { line: 0, p0x: 0, p0y: 0, a0: 0, a1: 1, cum: new Float64Array(ARC_STEPS + 1), total: 1 };
}

const point: [number, number] = [0, 0];
const from: [number, number] = [0, 0];
const to: [number, number] = [0, 0];

/** A point of the item's path at the share `v` (0 to 1) of its own parameter. Not by length: see `routeAt`. */
function pathAt(vp: Vp, r: Route, v: number, out: [number, number]): void {
  lineAt(vp, r.line, mix(r.a0, r.a1, v), point);
  const join = smootherstep(ramp(v, 0, JOIN_END));
  out[0] = mix(r.p0x, point[0], join);
  out[1] = mix(r.p0y, point[1], join);
}

/** The line nearest an item, the foot of the perpendicular on it, the end of the ride and the path's length. */
export function setupRoute(
  vp: Vp,
  bx: number,
  by: number,
  margin: number,
  out: Route,
  place = 0,
): Route {
  const unit = vp.h / 6;
  const half = 0.75 * Math.hypot(vp.w, vp.h);
  // Each preview keeps its rail while the orbit underneath it keeps turning.
  const best = Math.round(place * (PLANE_COUNT - 1)) % LINES.length;
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
  // The length of the path up to each cut, so that `routeAt` can walk it at a constant speed, and the
  // length at which the item is clear of the screen (its reach is a little over half its diagonal, and
  // it has shrunk by then): the ride ends there, so no scroll is spent on a picture nobody can see.
  const reachNow = margin * 0.55;
  out.cum[0] = 0;
  out.total = 0;
  pathAt(vp, out, 0, from);
  let clearBefore = outside(vp, from, reachNow);
  let found = false;
  for (let i = 1; i <= ARC_STEPS; i++) {
    pathAt(vp, out, i / ARC_STEPS, to);
    out.cum[i] = out.cum[i - 1]! + Math.hypot(to[0] - from[0], to[1] - from[1]);
    const clear = outside(vp, to, reachNow);
    if (!found && clear >= 0) {
      found = true;
      const t = clearBefore < 0 ? -clearBefore / (clear - clearBefore) : 0;
      out.total = out.cum[i - 1]! + t * (out.cum[i]! - out.cum[i - 1]!);
    }
    clearBefore = clear;
    from[0] = to[0];
    from[1] = to[1];
  }
  if (!found) out.total = out.cum[ARC_STEPS]!;
  out.total = Math.max(1, out.total);
  return out;
}

/** How far a disc of radius `r` at `p` is outside the screen: negative while any of it is on the screen. */
function outside(vp: Vp, p: readonly [number, number], r: number): number {
  const dx = Math.abs(p[0]) - vp.w / 2;
  const dy = Math.abs(p[1]) - vp.h / 2;
  return Math.max(dx, dy) - r;
}

/**
 * The item's centre at the progress `u` of its ride (0 its own place, 1 clear of the screen). The
 * ride is walked by LENGTH, not by the path's own parameter: the join and the bend of the line would
 * otherwise make it slow and fast, so the item moves the same distance for the same scroll.
 */
export function routeAt(vp: Vp, r: Route, u: number, out: [number, number]): void {
  const want = steady(u) * r.total;
  let i = 0;
  while (i < ARC_STEPS - 1 && r.cum[i + 1]! < want) i++;
  const span = r.cum[i + 1]! - r.cum[i]!;
  const t = span > 1e-9 ? clamp((want - r.cum[i]!) / span) : 0;
  pathAt(vp, r, (i + t) / ARC_STEPS, out);
}

/** The place of an item in the order of leaving: the leader (the trailer) first, the tail of the train last (0 to 1). */
export function leaveRank(a: number): number {
  return a;
}

/** One item's own progress for the set's `f`: it starts `rank * STAGGER` late, and it ends at `f` = 1. */
export function itemProgress(f: number, rank: number): number {
  const delay = rank * STAGGER;
  return clamp((f - delay) / (1 - delay));
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
  setupRoute(vp, base.x, base.y, Math.hypot(base.w, base.h) * 0.8, route, a);
  routeAt(vp, route, u, spot);
  const g = steady(u);
  const shrink = mix(1, END_SCALE, ramp(g, 0.05, 1));

  // The spiral: a roll in the screen's plane, a yaw about the item's own vertical axis, a small tumble.
  const roll = seed.side * (0.5 + 0.7 * seed.roll) * Math.PI * g;
  // The turn about the vertical stays under a quarter turn: at a steady speed a full turn kept the big
  // video edge on (a dark sliver) for much of the exit, and the owner wants to see it move right.
  const yaw = seed.side * (0.2 + 0.25 * seed.yaw) * Math.PI * g;
  const tumble = Math.sin(Math.PI * u) * (0.35 + 0.35 * seed.tumble) * -seed.side;
  qFromEuler(tumble, yaw, roll, qa);
  qMul(qa, base.q, qb);

  out.x = spot[0];
  out.y = spot[1];
  // No recede in depth: under the lens it slows the picture on the screen toward the end.
  out.z = base.z;
  out.q[0] = qb[0];
  out.q[1] = qb[1];
  out.q[2] = qb[2];
  out.q[3] = qb[3];
  out.w = base.w * shrink;
  out.h = base.h * shrink;
  out.corner = base.corner * shrink;
  out.opacity = base.opacity * (1 - smootherstep(ramp(u, 0.85, 1)));
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
  setupRoute(vp, base.x, base.y, Math.hypot(base.w, base.h) * 0.8, route, a);
  const span = Math.min(u, TRAIL_SPAN);
  for (let j = 0; j < TRAIL_POINTS; j++) {
    routeAt(vp, route, u - (span * j) / (TRAIL_POINTS - 1), spot);
    out[at + j * 2] = spot[0];
    out[at + j * 2 + 1] = spot[1];
  }
  return TRAIL_POINTS;
}
