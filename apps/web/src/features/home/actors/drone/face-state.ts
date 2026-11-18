/**
 * The drone's face: which drawing is shown, how far the eyes are shut and where they look. The
 * drawings cannot be blended, so one is changed for another behind a quick blink. It also blinks
 * by itself at uneven intervals, sometimes twice, except on the drawings that have no eyes to shut
 * (`blinks: false`). Taken from `about/choreo/face.ts` with the home's twenty-seven faces, and no
 * allocation per step.
 */
import { clamp01, springTo, type Sprung } from "./ease";
import { FACES, type FaceName } from "./faces";

export interface Face {
  shown: FaceName;
  /** Seconds into the blink that hides a change of drawing, or -1. */
  swap: number;
  /** Seconds into a blink of its own, or -1 (a value between -1 and 0 is the pause of a double). */
  blink: number;
  again: boolean;
  /** Seconds until the next blink. */
  next: number;
  eyeX: Sprung;
  eyeY: Sprung;
  seed: number;
}

/** What one step gives the scene. `blink` is 0 open, 1 shut; the look is in the atlas's units. */
export interface FaceFrame {
  shown: FaceName;
  blink: number;
  lookX: number;
  lookY: number;
}

/** Seconds a blink takes, and the part of it spent closing. */
const BLINK = 0.17;
export const SWAP = 0.15;
const CLOSING = 0.4;
/** How far the eyes slide, in parts of a cell. */
const EYE_REACH = 0.085;

export function createFace(seed = 7): Face {
  return {
    shown: "normal",
    swap: -1,
    blink: -1,
    again: false,
    next: 1.4,
    eyeX: { x: 0, v: 0 },
    eyeY: { x: 0, v: 0 },
    seed,
  };
}

export function createFaceFrame(): FaceFrame {
  return { shown: "normal", blink: 0, lookX: 0, lookY: 0 };
}

const unit = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v);

/** A small repeatable source of numbers from 0 to 1, so the blinks are uneven but testable. */
function random(face: Face): number {
  face.seed = (face.seed * 1664525 + 1013904223) >>> 0;
  return face.seed / 4294967296;
}

/** How shut the eyes are at the fraction `p` of a blink: quick to close, slower to open. */
export function lid(p: number): number {
  const v = clamp01(p);
  if (v < CLOSING) {
    const t = v / CLOSING;
    return t * t * (3 - 2 * t);
  }
  const t = (v - CLOSING) / (1 - CLOSING);
  return 1 - t * t * (3 - 2 * t);
}

/** Wear a drawing at once, with no blink: a probe holding a frame, or a drone that was hidden. */
export function setFaceNow(face: Face, name: FaceName): void {
  face.shown = name;
  face.swap = -1;
  face.blink = -1;
  face.again = false;
}

/**
 * One step. `wanted` is the drawing the drone should wear, `eyeX` and `eyeY` where it looks (-1 to
 * 1 each way, right and down positive). The frame is written into `out`.
 */
export function stepFace(
  face: Face,
  wanted: FaceName,
  eyeX: number,
  eyeY: number,
  dt: number,
  out: FaceFrame,
): FaceFrame {
  let shut = 0;

  // A change of drawing: shut, change at the darkest moment, open.
  if (face.swap < 0 && wanted !== face.shown) face.swap = 0;
  if (face.swap >= 0) {
    face.swap += dt;
    if (face.swap >= SWAP * CLOSING) face.shown = wanted;
    shut = lid(face.swap / SWAP);
    if (face.swap >= SWAP) face.swap = wanted === face.shown ? -1 : 0;
  }

  // Its own blinks, on a drawing that has eyes to shut.
  const blinks = FACES[face.shown].blinks;
  if (face.blink < 0) {
    face.next -= dt;
    if (face.next <= 0) {
      face.next = 1.5 + random(face) * random(face) * 5;
      if (blinks) {
        face.blink = 0;
        face.again = random(face) < 0.24;
      }
    }
  } else {
    face.blink += dt;
    shut = Math.max(shut, lid(face.blink / BLINK));
    if (face.blink >= BLINK) {
      // A double blink: the second follows after a breath.
      face.blink = face.again ? -0.09 : -1;
      face.again = false;
    }
  }
  // Between the two blinks of a double the count runs up through the pause.
  if (face.blink < 0 && face.blink > -1) face.blink = Math.min(0, face.blink + dt);

  springTo(face.eyeX, unit(eyeX) * EYE_REACH, 16, dt);
  springTo(face.eyeY, unit(eyeY) * EYE_REACH * 0.7, 16, dt);
  out.shown = face.shown;
  out.blink = shut;
  out.lookX = face.eyeX.x;
  out.lookY = face.eyeY.x;
  return out;
}
