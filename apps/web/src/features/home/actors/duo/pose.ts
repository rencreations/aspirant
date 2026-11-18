import type { FaceLive, FaceName, FaceShape } from "./face";

/**
 * The shapes the duo's performance and its scene pass between them. No three here.
 *
 * The frame is the home stage's: the origin is the middle of the screen, x to the right, y UP, one
 * unit a CSS pixel at z = 0, and `z` is pixels toward the visitor (it decides who is in front and
 * how big the perspective makes a thing; the scene compensates so a place is the place on screen).
 * Lengths on a drone itself are in radii of its ball.
 */

export interface Vec2 {
  x: number;
  y: number;
}

/** Which of the two drones. `a` is the bold one, `b` the soft one (as in /about). */
export type DroneId = "a" | "b";

/** The drone's own sides. `L` is the drone's left hand: on the RIGHT of the screen when it faces us. */
export type Hand = "L" | "R";

export interface GlovePose {
  /** Where the glove's middle is from the ball's middle, in radii: right, up, toward the visitor. */
  x: number;
  y: number;
  z: number;
  /** Its turn, in radians, about its own axes (z runs out through the star, y is up). */
  rx: number;
  ry: number;
  rz: number;
  /** Its size, 1 as modelled. */
  size: number;
  /**
   * True: the place was worked out to land on a point of the SCREEN (the scene undoes the perspective
   * so the glove is exactly there), not just beside the ball.
   */
  free: boolean;
}

export interface EarPose {
  /** Radians. `splay` leans the ear outward, `fold` tips it forward, `twist` turns its panel out. */
  splay: number;
  fold: number;
  twist: number;
}

/** One frame of one drone, as the springs hand it to the scene. */
export interface DronePose {
  /** The ball's middle on the stage, in CSS pixels, how near it is, and its radius on the screen. */
  x: number;
  y: number;
  z: number;
  radius: number;
  /** Radians. `yaw` faces the right of the screen, `pitch` puts the face down, `roll` is anticlockwise. */
  yaw: number;
  pitch: number;
  roll: number;
  /** The ball's own turn about the line of sight, on top of the roll: it rolls like a wheel. */
  spin: number;
  /** 1 as modelled, under 1 squashed (and wider), over 1 stretched (and thinner). */
  squash: number;
  /** The ears and the gloves, by the model's side. */
  earL: EarPose;
  earR: EarPose;
  gloveL: GlovePose;
  gloveR: GlovePose;
  face: FaceShape;
  live: FaceLive;
}

/** What a glove wants. `fx`, `fy` are a point of the stage in pixels and count only while `free`. */
export interface GloveGoal extends GlovePose {
  fx: number;
  fy: number;
  /** How quick the glove follows, how loose it is (under 1 it swings past), and whether it does not lag at all. */
  omega: number;
  zeta: number;
  hard: boolean;
}

export interface DroneGoal {
  x: number;
  y: number;
  z: number;
  radius: number;
  yaw: number;
  pitch: number;
  roll: number;
  spin: number;
  squash: number;
  earL: EarPose;
  earR: EarPose;
  gl: GloveGoal;
  gr: GloveGoal;
  face: FaceName;
  /** A point of the stage to look at, and how much the ball turns to it (the eyes always do). */
  look: Vec2 | null;
  turn: number;
  /** A lid held shut, 0 to 1, a wink of one eye each, and how lit the screen is. */
  lid: number;
  winkL: number;
  winkR: number;
  on: number;
  /** How quick the ball follows its place. */
  omega: number;
  /** Whether the ball leans into its own speed. */
  lean: boolean;
}

export const earGoal = (): EarPose => ({ splay: 0, fold: 0, twist: 0 });

export const gloveGoal = (): GloveGoal => ({
  x: 0,
  y: 0,
  z: 0,
  rx: 0,
  ry: 0,
  rz: 0,
  size: 1,
  free: false,
  fx: 0,
  fy: 0,
  omega: 17,
  zeta: 0.55,
  hard: false,
});

export const newGoal = (): DroneGoal => ({
  x: 0,
  y: 0,
  z: 0,
  radius: 50,
  yaw: 0,
  pitch: 0,
  roll: 0,
  spin: 0,
  squash: 1,
  earL: earGoal(),
  earR: earGoal(),
  gl: gloveGoal(),
  gr: gloveGoal(),
  face: "soft",
  look: null,
  turn: 0,
  lid: 0,
  winkL: 0,
  winkR: 0,
  on: 1,
  omega: 9,
  lean: true,
});

export const glovePose = (): GlovePose => ({
  x: 0,
  y: 0,
  z: 0,
  rx: 0,
  ry: 0,
  rz: 0,
  size: 1,
  free: false,
});

/** The comic marks the performance asks for. The section hands them to the home's marks pass. */
export type DuoMarkKind =
  | "bang"
  | "ask"
  | "spark"
  | "heart"
  | "lines"
  | "drop"
  | "puff"
  | "swirl"
  | "ha"
  | "vein"
  | "star"
  | "note";
export type DuoMarkTone = "ink" | "pink" | "gold" | "cyan";

/**
 * One mark, where it should show: a point of the stage in pixels (y up), its size (a multiplier,
 * already scaled by the size of the drone that made it: 1 is a mark 64 px tall beside a ball 140 px
 * tall) and its turn in degrees.
 */
export interface DuoMark {
  kind: DuoMarkKind;
  x: number;
  y: number;
  tone: DuoMarkTone;
  size: number;
  turn: number;
  /** Which drone it came from. */
  from: DroneId;
}

/**
 * Where a glove that rests at (`x`, `y`, `z`) radii in the ball's own frame is, from the ball's
 * middle in radii of the screen, once the ball has turned by `yaw` and `roll` (the roll first, then
 * the yaw, as the scene does). `out.z` is toward the visitor.
 */
export function gloveOffset(
  out: { x: number; y: number; z: number },
  x: number,
  y: number,
  z: number,
  yaw: number,
  roll: number,
): void {
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const rx = x * cr - y * sr;
  out.x = rx * cy + z * sy;
  out.y = x * sr + y * cr;
  out.z = -rx * sy + z * cy;
}
