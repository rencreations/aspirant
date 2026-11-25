import type { FaceLive, FaceShape } from "./face";

/**
 * One frame of one of Guinevere's two drones, as its body (`choreo/companion.ts`) hands it to the
 * drone's scene. No three here: the body is plain arithmetic, the scene turns this into six rigid
 * parts (`drone/companion-model.ts`).
 *
 * The pass they are drawn in is flat: a place is in CSS pixels of the screen (x to the right, y
 * down), and `z` is pixels toward the visitor, which only decides who is in front. Lengths on the companion itself
 * are in radii of its ball.
 */
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
}

export interface EarPose {
  /** Radians. `splay` leans the ear outward, `fold` tips it forward, `twist` turns its panel out. */
  splay: number;
  fold: number;
  twist: number;
}

export interface CompanionPose {
  /** The ball's middle on the stage, in CSS pixels, and how near it is. */
  x: number;
  y: number;
  z: number;
  /** The ball's radius, in CSS pixels. */
  radius: number;
  /** Radians. `yaw` faces the right of the screen, `pitch` puts the face down, `roll` is anticlockwise. */
  yaw: number;
  pitch: number;
  roll: number;
  /** The ball's own turn about the line of sight, on top of the roll: it rolls like a wheel. */
  spin: number;
  /** 1 as modelled, under 1 squashed (and wider), over 1 stretched (and thinner). */
  squash: number;
  /** The ears, by the model's side: `L` is on the right of the screen when it faces the visitor. */
  earL: EarPose;
  earR: EarPose;
  /** The gloves, by the same sides. */
  gloveL: GlovePose;
  gloveR: GlovePose;
  face: FaceShape;
  live: FaceLive;
}
