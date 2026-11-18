/**
 * The shapes the picture field shares between its pure parts (formations, projection) and its
 * three.js parts (cards, passes). No three.js here.
 *
 * The frame is the stage's pixel frame: the origin is the middle of the viewport, x goes right, y
 * goes up, one unit is one CSS pixel at z = 0, and z grows toward the camera. A card's `h` is its
 * height in that frame: at z = 0 it is also its height on the screen, nearer cards look larger.
 */
import type { Q } from "./math";

export interface Vp {
  readonly w: number;
  readonly h: number;
}

/** One card's pose. A formation writes it, the field draws it. */
export interface CardPose {
  x: number;
  y: number;
  z: number;
  q: Q;
  /** Height of the card in the frame. */
  h: number;
  /** Width over height of the card's shape (0.8 for the hero cards, 16 over 9 on the wall). */
  aspect: number;
  /** 0 shows the portrait picture, 1 shows the wide one. */
  shape: number;
  opacity: number;
  /** How much of the live motion (idle float, pointer parallax, hover) still applies, 0 to 1. */
  live: number;
}

export function makePose(): CardPose {
  return {
    x: 0,
    y: 0,
    z: 0,
    q: [0, 0, 0, 1],
    h: 100,
    aspect: 0.8,
    shape: 0,
    opacity: 1,
    live: 1,
  };
}

export function copyPose(a: CardPose, out: CardPose): CardPose {
  out.x = a.x;
  out.y = a.y;
  out.z = a.z;
  out.q[0] = a.q[0];
  out.q[1] = a.q[1];
  out.q[2] = a.q[2];
  out.q[3] = a.q[3];
  out.h = a.h;
  out.aspect = a.aspect;
  out.shape = a.shape;
  out.opacity = a.opacity;
  out.live = a.live;
  return out;
}

/** A formation writes the pose of card `i` into `out`. It must not allocate. */
export type PoseFn = (i: number, out: CardPose) => void;

/** A rectangle in CSS pixels, origin top left (the DOM's own frame). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The four corners of a card on the screen, CSS pixels, origin top left, in order around it. */
export type Quad = [number, number, number, number, number, number, number, number];
