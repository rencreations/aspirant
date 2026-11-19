/**
 * The hero's entrance: every card is a sheet of paper thrown out from behind the logo. Pure functions
 * of (seconds since the start, card index, the card's rank by distance from the middle), so a frame is
 * the same on every load and nothing is allocated per frame.
 *
 * Each card has its own flight (`flightOf`, a hash of its index, no random state):
 *   - its own start (the stagger, nearest the middle first) and its own duration (1.4 to 2.6 s),
 *   - a cubic bezier path with an S bend (never a straight line),
 *   - a sine sway across the heading whose amplitude dies away,
 *   - a lift toward the camera while it is fast, and a size that grows out of the heap,
 *   - a tumble (roll, yaw, tilt, each with its own cycles and phase) that settles to the card's tilt,
 *   - an ease that launches fast, drifts, and lands with a small overshoot (a back ease).
 * At the end of the flight the pose is the target's, exactly, with no speed.
 */
import { poseOf, type FormationName, type FormationSet } from "./formations";
import { clamp, mix, qFromEuler, qMul, qSlerp, ramp, smootherstep, TAU, type Q } from "./math";
import { copyPose, makePose, type CardPose } from "./types";

/** The numbers of the entrance (seconds). */
export const FLIGHT = {
  /** The whole entrance: the last card has landed by then. */
  total: 2.8,
  /** The starts of the cards are spread over this long (the nearest to the logo goes first). */
  stagger: 0.9,
  minDuration: 1.4,
  maxDuration: 2.6,
} as const;

/** A sine on a card's angle: the amplitude (rad), the cycles over the flight and the phase (rad). */
export interface Wave {
  amp: number;
  cycles: number;
  phase: number;
}

export interface Flight {
  /** Seconds after the start of the entrance. */
  delay: number;
  duration: number;
  /** The two control points of the path stand off the chord by these shares of its length (signed). */
  bow1: number;
  bow2: number;
  /** The sway across the heading: a share of the chord (plus a few px), cycles, phase. */
  sway: Wave;
  /** The overshoot constant of the back ease: 0.9 is a hair (3 percent), 1.5 a small bounce (8 percent). */
  overshoot: number;
  /** The share of the flight by which the card has its full size. */
  growEnd: number;
  /** How far toward the camera the card is lifted at the peak (px of z). */
  lift: number;
  roll: Wave;
  yaw: Wave;
  tilt: Wave;
}

export function makeFlight(): Flight {
  const wave = (): Wave => ({ amp: 0, cycles: 1, phase: 0 });
  return {
    delay: 0,
    duration: 1,
    bow1: 0,
    bow2: 0,
    sway: wave(),
    overshoot: 1,
    growEnd: 0.5,
    lift: 0,
    roll: wave(),
    yaw: wave(),
    tilt: wave(),
  };
}

/** A number in [0, 1) from a card and a slot: an integer hash, the same everywhere, no state. */
export function hash01(i: number, k: number): number {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 1, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const sign = (r: number): number => (r < 0.5 ? -1 : 1);

/**
 * The flight of card `i`, whose rank by distance from the middle is `rank` (0 the nearest, 1 the
 * farthest). Writes into `out`.
 */
export function flightOf(i: number, rank: number, out: Flight): Flight {
  const r = (k: number): number => hash01(i, k);
  const rk = clamp(rank);
  // The nearest card goes first; a small jitter keeps neighbours from moving as a block.
  out.delay = Math.max(0, FLIGHT.stagger * Math.pow(rk, 0.9) + (r(0) - 0.5) * 0.08);
  // Every card is down by `total`: the late ones have the shorter flights.
  const longest = Math.min(FLIGHT.maxDuration, FLIGHT.total - out.delay);
  out.duration = FLIGHT.minDuration + r(1) * Math.max(0, longest - FLIGHT.minDuration);
  out.bow1 = sign(r(2)) * (0.1 + 0.2 * r(3));
  out.bow2 = sign(r(4)) * (0.05 + 0.18 * r(5));
  out.sway.amp = 0.035 + 0.05 * r(6);
  out.sway.cycles = 1.2 + 1.3 * r(7);
  out.sway.phase = TAU * r(8);
  out.overshoot = 0.9 + 0.6 * r(9);
  out.growEnd = 0.45 + 0.3 * r(10);
  out.lift = 40 + 90 * r(11);
  out.roll.amp = sign(r(12)) * (0.35 + 0.5 * r(13));
  out.roll.cycles = 0.7 + 0.9 * r(14);
  out.roll.phase = TAU * r(15);
  out.yaw.amp = sign(r(16)) * (0.45 + 0.65 * r(17));
  out.yaw.cycles = 0.6 + 0.7 * r(18);
  out.yaw.phase = TAU * r(19);
  out.tilt.amp = sign(r(20)) * (0.3 + 0.5 * r(21));
  out.tilt.cycles = 0.8 + 0.9 * r(22);
  out.tilt.phase = TAU * r(23);
  return out;
}

/** The second at which the card has landed. */
export const landsAt = (f: Flight): number => f.delay + f.duration;

/**
 * The back ease: fast at the start (about four times the average speed), past the mark at the
 * middle, a small overshoot, and back to exactly 1 with no speed at `s` = 1. `c` is the overshoot
 * constant (1 gives 3.7 percent).
 */
export function backEase(s: number, c: number): number {
  const x = clamp(s) - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
}

/** 1 for the middle of the flight, 0 at both ends, with no slope at the ends: the tumble's strength. */
function settle(s: number): number {
  return (1 - smootherstep(ramp(s, 0.15, 1))) * smootherstep(ramp(s, 0, 0.12));
}

const evalWave = (w: Wave, s: number): number => w.amp * Math.sin(TAU * w.cycles * s + w.phase);

const scratchFlight = makeFlight();
const originPose = makePose();
const targetPose = makePose();
const tumble: Q = [0, 0, 0, 1];
const base: Q = [0, 0, 0, 1];

/**
 * The pose of one card `seconds` after the entrance began, flying from `origin` to `target`.
 * `seconds` before the start is the origin, after the landing it is the target, both exactly.
 */
export function flightPose(
  origin: CardPose,
  target: CardPose,
  f: Flight,
  seconds: number,
  out: CardPose,
): CardPose {
  const s = clamp((seconds - f.delay) / f.duration);
  if (s <= 0) return copyPose(origin, out);
  // The landing second itself is the target, whatever the rounding of the division.
  if (s >= 1 - 1e-9) return copyPose(target, out);

  const e = backEase(s, f.overshoot);
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const len = Math.hypot(dx, dy);
  const nx = len > 1e-6 ? -dy / len : 0;
  const ny = len > 1e-6 ? dx / len : 1;

  // The path: a cubic bezier with an S bend, walked by the eased progress (so it overshoots a hair).
  const c1x = origin.x + dx * 0.28 + nx * f.bow1 * len;
  const c1y = origin.y + dy * 0.28 + ny * f.bow1 * len;
  const c2x = origin.x + dx * 0.72 + nx * f.bow2 * len;
  const c2y = origin.y + dy * 0.72 + ny * f.bow2 * len;
  const u = e;
  const v = 1 - u;
  const b0 = v * v * v;
  const b1 = 3 * v * v * u;
  const b2 = 3 * v * u * u;
  const b3 = u * u * u;
  let x = b0 * origin.x + b1 * c1x + b2 * c2x + b3 * target.x;
  let y = b0 * origin.y + b1 * c1y + b2 * c2y + b3 * target.y;
  // The sway across the heading, strongest in the middle and gone at the landing.
  const sway =
    (f.sway.amp * len + 6) * Math.sin(TAU * f.sway.cycles * s + f.sway.phase) * settle(s);
  x += nx * sway;
  y += ny * sway;

  // Lifted toward the camera while it is fast, down at the landing.
  const bump = Math.sin(Math.PI * clamp(e));
  const z = target.z + f.lift * bump * bump;

  // Grows out of the heap; the picture comes in over the first part.
  const grow = 1 - Math.pow(1 - clamp(s / f.growEnd), 2.5);

  // The tumble on top of the turn from flat to the card's own tilt.
  const k = settle(s);
  qFromEuler(evalWave(f.tilt, s) * k, evalWave(f.yaw, s) * k, evalWave(f.roll, s) * k, tumble);
  qSlerp(origin.q, target.q, clamp(e), base);
  qMul(tumble, base, out.q);

  out.x = x;
  out.y = y;
  out.z = z;
  out.h = mix(origin.h, target.h, grow);
  out.aspect = target.aspect;
  out.shape = target.shape;
  out.opacity = target.opacity * smootherstep(ramp(s, 0, 0.22));
  out.live = target.live * smootherstep(ramp(s, 0.4, 1));
  return out;
}

/**
 * The entrance of card `i` of a formation set: from the heap behind the logo to the formation `to`
 * (the scatter, or whatever the story shows now), `seconds` after the start. A cell that is not one of
 * the hero's cards is the target's own (the wall's cells wait hidden).
 */
export function flyFormation(
  set: FormationSet,
  to: { name: FormationName; t?: number },
  seconds: number,
  rank: number,
  i: number,
  slide: number,
  out: CardPose,
): CardPose {
  poseOf(set, to.name, to.t ?? 0, i, slide, targetPose);
  if (i >= set.n) return copyPose(targetPose, out);
  poseOf(set, "origin", 0, i, slide, originPose);
  return flightPose(originPose, targetPose, flightOf(i, rank, scratchFlight), seconds, out);
}
