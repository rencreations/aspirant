/**
 * The scroll lock of the pair (round eight, 20 Nov 2026). The owner: "the drone will move weirdly because
 * it's still reacting to cursor position and have normal animation. Lock the interactables by cursor
 * position or anything when scrolling and add tolerance before and after. Once the drone stopped or
 * user stop scrolling and drone is idle, turn on the interactable again."
 *
 * One number, the `weight` of the pair's own life (what the visitor starts and what the pair do by
 * themselves), 0 to 1. It is a pure function of the scroll and of how still the drone is:
 *
 *  - BEFORE (the tolerance in front): the weight starts to fall as soon as the scroll is active. That is
 *    a scroll speed above `SPEED_ON` screens a second, or any wheel or touch input (`INPUT_ON`) within
 *    the last `INPUT_HOLD` seconds. The speed has a hysteresis: once locked, the scroll counts as active
 *    until it falls under `SPEED_OFF`.
 *  - AFTER (the tolerance behind): the lock is let go only when the scroll has been calm for `CALM_FOR`
 *    seconds AND the drone has settled (its own speed is under `SETTLED`, in drone heights a second).
 *  - The weight never jumps: it falls over `RAMP_DOWN` seconds and rises over `RAMP_UP`, both on a
 *    smoothstep, so a lock that begins while the weight is rising turns round from where it is.
 *
 * No three and no allocation: the state is one small object, written in place.
 */

/** Scroll speed (screens a second) above which the scroll is active, and under which it is calm again. */
export const SPEED_ON = 0.15;
export const SPEED_OFF = 0.07;
/** The smoothed wheel or touch energy (pixels a second) that counts as input, and how long it holds the lock. */
const INPUT_ON = 20;
const INPUT_HOLD = 0.12;
/** The scroll must be calm this long (seconds) before the lock can be let go. */
export const CALM_FOR = 0.45;
/** The drone is settled when it moves slower than this (drone heights a second). */
export const SETTLED = 0.3;
/** How long the weight takes to fall to 0 and to rise to 1 (seconds). */
export const RAMP_DOWN = 0.15;
export const RAMP_UP = 0.4;

export interface LockState {
  /** The lock is on (the weight is falling or at 0). */
  locked: boolean;
  /** Seconds since the last wheel or touch input. */
  sinceInput: number;
  /** Seconds the scroll has been calm. */
  calm: number;
  /** 0 to 1, the progress of the ramp: the weight is its smoothstep. */
  t: number;
  /** The weight of the pair's life, 0 to 1. */
  weight: number;
}

export interface LockInput {
  /** The scroll's speed in screens a second, signed. */
  velocity: number;
  /** The smoothed wheel or touch velocity in pixels a second, signed. */
  wheel: number;
  /** The drone's own speed in drone heights a second (what is drawn, all motions included). */
  droneSpeed: number;
}

/** A lock that starts closed: a pair that has just come on screen is not asked anything for a moment. */
export function createLock(): LockState {
  return { locked: true, sinceInput: 1, calm: 0, t: 0, weight: 0 };
}

/** Put the lock where a jump leaves it (a seek, a scrollbar drag): closed, and the weight at 0. */
export function closeLock(s: LockState): LockState {
  s.locked = true;
  s.sinceInput = 1;
  s.calm = 0;
  s.t = 0;
  s.weight = 0;
  return s;
}

const smoothstep = (t: number): number => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};

/** Advance the lock by `dt` seconds. Returns the weight (also in `s.weight`). */
export function stepLock(s: LockState, dt: number, input: LockInput): number {
  const d = dt > 0 ? Math.min(dt, 0.1) : 0;
  const speed = Math.abs(input.velocity);
  const wheel = Math.abs(input.wheel);
  if (wheel > INPUT_ON) s.sinceInput = 0;
  else s.sinceInput += d;
  const moving = speed > (s.locked ? SPEED_OFF : SPEED_ON);
  const active = moving || s.sinceInput < INPUT_HOLD;
  if (active) s.calm = 0;
  else s.calm += d;
  if (active) s.locked = true;
  else if (s.locked && s.calm >= CALM_FOR && input.droneSpeed < SETTLED) s.locked = false;
  s.t = s.locked ? Math.max(0, s.t - d / RAMP_DOWN) : Math.min(1, s.t + d / RAMP_UP);
  s.weight = smoothstep(s.t);
  return s.weight;
}
