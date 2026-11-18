/**
 * The live motion of a card on top of its formation: the pointer's push, the idle float, the
 * depth parallax, the streak and the paper bend that follow its own speed. Pure functions that
 * write into an `out` (the frame loop allocates nothing). Numbers are premotio's (digest 1.5) and
 * garuda's (2.3), scaled where the cards here are bigger and fewer.
 */
import { clamp, mix, ramp } from "./math";

/** The push of the pointer on a card (digest 1.5). `gain` scales the whole force for this field. */
const PUSH = {
  radiusMin: 190,
  radiusShare: 0.42,
  base: 1950,
  speedGain: 4.4,
  dragGain: 4.8,
  speedCap: 2000,
  gain: 0.45,
} as const;

/** The spring of a card's offset: period 1.15 s, damping 0.56 (premotio). */
export const OFFSET_SPRING = { omega: (2 * Math.PI) / 1.15, zeta: 0.56 } as const;
/** The spring of a card's tilt: period 1.5 s, damping 0.45. */
export const TILT_SPRING = { omega: (2 * Math.PI) / 1.5, zeta: 0.45 } as const;

/** How far from the pointer a card is still pushed (px), for a viewport. */
export function pushRadius(w: number, h: number): number {
  return Math.max(PUSH.radiusMin, PUSH.radiusShare * Math.min(w, h));
}

/**
 * The push of the pointer on one card, in px/s^2, both in screen pixels of one orientation. The
 * pointer is at (px, py) moving (vx, vy) px/s at `speed`; the card's centre is at (cx, cy). The push
 * falls off as `(1 - (d/R)^2)^2`, goes away from the pointer, and carries the pointer's own stroke.
 */
export function pointerForce(
  px: number,
  py: number,
  cx: number,
  cy: number,
  radius: number,
  speed: number,
  vx: number,
  vy: number,
  out: [number, number],
): [number, number] {
  const dx = cx - px;
  const dy = cy - py;
  const d = Math.hypot(dx, dy);
  if (d >= radius) {
    out[0] = 0;
    out[1] = 0;
    return out;
  }
  const q = 1 - (d / radius) * (d / radius);
  const w = q * q * PUSH.gain;
  const s = Math.min(speed, PUSH.speedCap);
  const away = PUSH.base + PUSH.speedGain * s;
  const nx = d > 1e-3 ? dx / d : 0;
  const ny = d > 1e-3 ? dy / d : 0;
  const hx = speed > 1 ? vx / speed : 0;
  const hy = speed > 1 ? vy / speed : 0;
  out[0] = w * (nx * away + hx * PUSH.dragGain * s);
  out[1] = w * (ny * away + hy * PUSH.dragGain * s);
  return out;
}

export interface Idle {
  /** Screen pixels. */
  x: number;
  y: number;
  /** Radians, about the card's own axes. */
  rx: number;
  ry: number;
  rz: number;
}

/** The slow idle float of garuda's hero: a few pixels and a few hundredths of a radian, out of phase per card. */
export function idleMotion(time: number, seed: number, out: Idle): Idle {
  const s = seed * 1.37 + 0.3;
  out.x = Math.cos(0.45 * time + s) * 9;
  out.y = Math.sin(0.6 * time + s) * 8;
  out.rx = Math.sin(0.5 * time + s) * 0.05;
  out.ry = Math.cos(0.4 * time + s) * 0.07;
  out.rz = Math.sin(0.3 * time + s) * 0.04;
  return out;
}

/**
 * The depth parallax of one card: a card toward the camera (z > 0) follows the pointer, a card
 * behind goes the other way. `ndc` is the pointer from -1 to 1. About 35 px at z = 170 and 74 px at
 * z = -430 for a full swing, scaled by 0.6 (digest 3.3).
 */
export function parallaxOffset(ndc: number, z: number): number {
  return 0.115 * z * ndc;
}

/** The longest streak, as a share of the shorter side of the viewport. */
export const STREAK_MAX_SHARE = 0.04;
/** Pixels of streak for one pixel per second of speed (premotio: 0.03). */
const STREAK_GAIN = 0.022;
/** Below this many pixels the streak is not drawn at all (one tap, no cost): the wall's slow slide stays crisp. */
const STREAK_MIN = 1.5;

/** The smear of a card that moves (vx, vy) px/s: along the motion, capped, in px. */
export function streakOf(
  vx: number,
  vy: number,
  shorter: number,
  out: [number, number],
): [number, number] {
  const speed = Math.hypot(vx, vy);
  const len = Math.min(speed * STREAK_GAIN, STREAK_MAX_SHARE * shorter);
  if (len < STREAK_MIN) {
    out[0] = 0;
    out[1] = 0;
    return out;
  }
  out[0] = (vx / speed) * len;
  out[1] = (vy / speed) * len;
  return out;
}

/** The paper bend (about 0 to 0.9) of a card moving at (vx, vy) px/s with its own roll `roll` (rad). */
export function bendOf(vx: number, vy: number, roll: number): number {
  const along = vx * Math.cos(roll) + vy * Math.sin(roll);
  return 0.9 * Math.tanh(along / 2400);
}

/** The flutter of a moving card, as a share of the card's height (premotio: tanh(speed / 2400) * 0.05). */
export function flutterOf(speed: number): number {
  return 0.05 * Math.tanh(speed / 2400);
}

/** The margin a card's quad needs around the card, in local units: the shadow and the half of the streak. */
export function quadPad(shadowReach: number, streakPx: number, scale: number): number {
  return shadowReach + (1.8 * 0.5 * streakPx) / Math.max(0.25, scale) + 2;
}

/** A hover lift 0 to 1 toward its target, as the ease of a half second. */
export function hoverEase(current: number, target: number, dt: number): number {
  const k = 1 - Math.exp(-10 * Math.max(0, dt));
  return clamp(current + (target - current) * k);
}

/** The edge smear of the frame by story progress: full in the hero, 35 percent once the wall has landed (digest 1.6). */
export function edgeStrength(p: number): number {
  return mix(1, 0.35, ramp(p, 0.42, 0.94));
}
