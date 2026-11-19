/**
 * Where the bolt and the fall happen on the scroll (round four, 20 Nov 2026). Both sections are plain
 * scroll linked: no zones, no clock plays, no idle snap, no wait. The one number that drives the scene
 * is `u`, the scroll in screens since the start of the bolt section (negative in its lead). The fall
 * section reads `u` past `BOLT_SCREENS`. Everything below is a pure function of `u`.
 *
 *   -0.25      the dragon's tail edge shows in the lower right corner (the strip's set flies off there)
 *   1.3        the head is at the start of the slow range
 *   1.3 to 3.7 the slow range: the head crawls through the middle (12 percent speed), the wheel turns
 *   3.7        the end of the slow range: the shake has peaked, she loses her grip (the fall begins)
 *   fall       she falls and the camera eases to centre her, then FIVE | PHASES, then TEN | HEROES
 *
 * This file imports no registry and no three, so the sections' `index.ts` can read it.
 */

/** The bolt's beats, in screens since its start. */
export const BOLT_AT = {
  /** Where the path starts (the head is beyond the lower right corner). */
  enter: -0.25,
  /** The slow range: the head crawls from here to there, with a smooth ramp at each end. */
  slowFrom: 1.3,
  slowTo: 3.7,
  /** The length of each ramp of the slow range, in screens (inside the range). */
  slowRamp: 0.55,
  /** The shake builds from here and peaks at `lose`. */
  shakeFrom: 3.1,
  /** The wheel turns from the first pair to the last over this range, with a pair in focus at each end. */
  wheelFrom: 1.45,
  wheelTo: 3.45,
  /** The end of the slow range: the doll loses her grip. */
  lose: 3.7,
} as const;

/** The head crawls at this share of its normal speed in the middle of the slow range. */
export const SLOW_SPEED = 0.12;

/** The bolt section's length in screens: it ends where she loses her grip. */
export const BOLT_SCREENS = BOLT_AT.lose;

/** The fall's beats, in screens since the start of the fall section. */
export const FALL_AT = {
  /** She falls and the camera moves: the doll's position and the camera ease in and out over this. */
  move: [0, 1.5],
  /** FIVE | PHASES come in once she is centred and the camera is still. */
  one: [1.5, 2.15],
  /** FIVE | PHASES turn into TEN | HEROES. */
  swap: [2.9, 3.55],
  /** TEN | HEROES leave upward while the hand rises (the hand's lead is the last half screen). */
  out: [4.05, 4.4],
} as const;

/** The fall section's length in screens. */
export const FALL_SCREENS = 4.5;

/** The lead of both sections, in screens. */
export const BOLT_LEAD = 0.5;
export const FALL_LEAD = 0.5;

/** The wheel: five pairs, the first in focus at `wheelFrom` and the last at `wheelTo`. */
export const WHEEL_ITEMS = 5;
