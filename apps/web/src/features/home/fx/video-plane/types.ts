/**
 * The shapes the film plane shares between its pure parts (the poses) and its three.js parts (the
 * planes, the pass). No three.js here.
 *
 * The frame is the stage's pixel frame (see `kernel/stage.ts`): the origin is the middle of the
 * viewport, x goes right, y goes up, one unit is one CSS pixel at z = 0, and z grows toward the
 * camera. A plane's `w` and `h` are its size in that frame.
 */
import type { Q } from "../image-field/math";

/** The size of the screen, CSS pixels. */
export interface Vp {
  readonly w: number;
  readonly h: number;
}

/** One plane's pose: the hero's, or a preview's. A producer writes it, the actor draws it. */
export interface PlanePose {
  x: number;
  y: number;
  z: number;
  q: Q;
  /** Size in the frame (the plane is a flat rectangle, `w` along its own x). */
  w: number;
  h: number;
  /** Corner radius in the frame's pixels. */
  corner: number;
  opacity: number;
  /** Painter's order among the planes (higher is drawn later, in front). */
  order: number;
  /** Paper bend and flutter of a plane in flight: `bend` is 1 over the width, `flutter` px. */
  bend: number;
  flutter: number;
}

export function makePlane(): PlanePose {
  return {
    x: 0,
    y: 0,
    z: 0,
    q: [0, 0, 0, 1],
    w: 100,
    h: 56,
    corner: 4,
    opacity: 1,
    order: 0,
    bend: 0,
    flutter: 0,
  };
}

export function copyPlane(a: PlanePose, out: PlanePose): PlanePose {
  out.x = a.x;
  out.y = a.y;
  out.z = a.z;
  out.q[0] = a.q[0];
  out.q[1] = a.q[1];
  out.q[2] = a.q[2];
  out.q[3] = a.q[3];
  out.w = a.w;
  out.h = a.h;
  out.corner = a.corner;
  out.opacity = a.opacity;
  out.order = a.order;
  out.bend = a.bend;
  out.flutter = a.flutter;
  return out;
}

/** Plane 0 is the trailer, 1 to 10 are the previews (eleven in all). */
export const PLANE_COUNT = 11;

/**
 * Everything a section tells the film in a frame (`FilmActor.show`). It is the whole state: what a
 * section leaves out falls back to `DEFAULT_STATE`, so nothing it set in an earlier frame (or an
 * earlier section did) leaks into this one.
 */
export interface FilmState {
  /** 0 to 1: the angled trailer appears between the cards (a small scale-up and a fade). */
  appear: number;
  /** 0 the trailer lies angled in the rows, 1 it stands upright as the strip. */
  morph: number;
  /** 0 the strip (3.70 to 1), 1 the full window (16 to 9 at the scene's width). */
  expand: number;
  /** 0 the window, 1 the trailer is the leader of the orbit and the ten previews have arrived. */
  pull: number;
  /** 0 the set stands, 1 the set has flown off to the bottom right. */
  fly: number;
  /** The orbit's turn from the scroll, radians (the actor adds its own slow drift). */
  travel: number;
  /** 0 the clean film, 1 the strip's effects overlay (ink, split colour, the dark wash). */
  effect: number;
  /** How the previews arrive: the camera pulls back ("dolly", the reference) or they leave the slit ("gather"). */
  arrival: "dolly" | "gather";
  /** Where the angled trailer lies on the rows' plane: plane pixels from its centre, and its size as a share of a card. */
  angleU: number;
  angleV: number;
  angleSize: number;
  /**
   * The film's own shape (width over height). The window the strip opens to takes it, so the picture
   * shows whole, uncropped. The strip keeps its own 3.70 to 1 ratio. The default is 16 to 9.
   */
  aspect: number;
  /** The point of the trailer the strip is centred on, fractions of its picture (y from the top). */
  focusX: number;
  focusY: number;
  /** A rectangle for the trailer's own base pose instead of the morph and the expand (CSS px, from the top left), or null. */
  heroBox: { x: number; y: number; w: number; h: number } | null;
}

export const DEFAULT_STATE: Readonly<FilmState> = {
  appear: 1,
  morph: 1,
  expand: 0,
  pull: 0,
  fly: 0,
  travel: 0,
  effect: 1,
  arrival: "dolly",
  angleU: 0,
  angleV: 0,
  angleSize: 0.62,
  aspect: 16 / 9,
  focusX: 0.5,
  focusY: 0.45,
  heroBox: null,
};

export function makeState(): FilmState {
  return { ...DEFAULT_STATE, heroBox: null };
}
