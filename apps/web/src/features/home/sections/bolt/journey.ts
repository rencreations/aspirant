/**
 * The choreography of the bolt and the fall as one pure function of `u`, the scroll in screens since
 * the start of the bolt section (`stations.ts`). No DOM, no three, no clock: the same `u` always gives
 * the same picture, up or down. `Journey.at(u, w, h)` fills public fields (reused, nothing is
 * allocated).
 *
 * The dragon flies in a straight diagonal from the lower right to the upper left with its body
 * parallel to the camera. The HEAD is what the path places: it crawls through the middle of the screen
 * (12 percent of its normal speed over the slow range, with a smooth ramp at each end) while the wheel
 * of names turns. At the end of the slow range the shake peaks and the doll loses her grip. From then
 * on the doll falls in the world, and a 2D camera in the stage's pixel plane eases in and out to zoom
 * on her and put her in the middle of the screen. The dragon is carried by the same camera, so it is
 * left behind and pushed out of the picture.
 */
import { BOLT_AT, BOLT_SCREENS, FALL_AT, SLOW_SPEED, WHEEL_ITEMS } from "./stations";

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smooth = (v: number): number => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
/** Ease in and out (a cubic: the doll and the camera leave and arrive gently). */
export const easeInOut = (v: number): number => {
  const x = clamp01(v);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** The size of the dragon's body block. The length is what the screen sees: see `dragonLength`. */
export const RIDE_SHARE = 0.6;
/** The doll at the end of the fall (joint J6): her height as a share of the viewport height, and her hips at the middle. */
export const END_HEIGHT = 0.38;
export const END_FEET_Y = (-0.396 / 1.7) * END_HEIGHT;
/** Her hips (the pivot of the fall) are this share of her height above her feet (0.396 of 1.7 file units). */
export const HIPS_ABOVE_FEET = 0.396 / 1.7;

/** How far the doll falls in the world during the move, in viewport heights, and the pace of it. */
const FALL_DISTANCE = 0.9;

/** The speed of the head along its path: 1 outside the slow range, `SLOW_SPEED` in the middle of it. */
export function headSpeed(u: number): number {
  const a = smooth((u - BOLT_AT.slowFrom) / BOLT_AT.slowRamp);
  const b = smooth((BOLT_AT.slowTo - u) / BOLT_AT.slowRamp);
  return 1 - (1 - SLOW_SPEED) * a * b;
}

// The path parameter is the integral of the speed, normalised so the middle of the slow range is the
// middle of the path (the range is symmetric about its middle and the path starts and ends the same
// distance from it).
const STEP = 0.01;
const U0 = BOLT_AT.enter;
const UMID = (BOLT_AT.slowFrom + BOLT_AT.slowTo) / 2;
const U1 = 2 * UMID - U0;
const COUNT = Math.round((U1 - U0) / STEP);
const CUM: number[] = [0];
for (let i = 1; i <= COUNT; i += 1) {
  const a = headSpeed(U0 + (i - 1) * STEP);
  const b = headSpeed(U0 + i * STEP);
  CUM.push(CUM[i - 1]! + ((a + b) / 2) * STEP);
}
const TOTAL = CUM[COUNT]!;

/** The path parameter at `u`: 0 where the path starts, 0.5 in the middle of the slow range, 1 where it ends. */
export function pathParam(u: number): number {
  if (u <= U0) return (u - U0) / TOTAL;
  if (u >= U1) return 1 + (u - U1) / TOTAL;
  const x = (u - U0) / STEP;
  const i = Math.min(COUNT - 1, Math.floor(x));
  const f = x - i;
  return (CUM[i]! + (CUM[i + 1]! - CUM[i]!) * f) / TOTAL;
}

/** The pair in focus on the wheel at `u`: 0 to 4, continuous (the wheel turns with the scroll). */
export function wheelAt(u: number): number {
  const t = (u - BOLT_AT.wheelFrom) / (BOLT_AT.wheelTo - BOLT_AT.wheelFrom);
  return clamp01(t) * (WHEEL_ITEMS - 1);
}

/** How much of the wheel shows: it comes in as the head slows and goes as the dragon shakes. */
export function wheelShow(u: number): number {
  return (
    smooth((u - (BOLT_AT.wheelFrom - 0.5)) / 0.5) *
    (1 - smooth((u - (BOLT_AT.wheelTo + 0.05)) / 0.4))
  );
}

/**
 * How far the white has risen, 0 to 1 (`rise`). It starts as the dragon comes in, is high at the end of
 * the slow range, stays through the fall and goes back down as the hand comes up.
 */
export const WHITE = {
  from: 0.35,
  /** The share of the white's layer at the end of the slow range, and at the end of the fall's move. */
  atLose: 0.68,
  atFall: 0.74,
} as const;

export function whiteRise(u: number): number {
  const fall = u - BOLT_SCREENS;
  if (fall < 0) {
    return WHITE.atLose * smooth((u - WHITE.from) / (BOLT_SCREENS - WHITE.from));
  }
  const up = WHITE.atLose + (WHITE.atFall - WHITE.atLose) * smooth(fall / FALL_AT.move[1]);
  // It sinks as the hand comes up under her (the last half screen of the fall section).
  return up * (1 - smooth((fall - (FALL_AT.out[0] + 0.1)) / 0.45));
}

/** How much of the strip's mist is left, 1 to 0: it thins out to the plain paper over the whole slow range. */
export function mistLeft(u: number): number {
  return 1 - smooth((u - 0.2) / (BOLT_SCREENS - 0.2 - 0.3));
}

/** The dragon's length on the screen, in pixels (a side view: the whole body along its diagonal). */
export function dragonLength(w: number, h: number): number {
  return 0.6 * Math.max(w, 0.9 * h);
}

export class Journey {
  w = 1;
  h = 1;
  /** The size unit: the viewport height, or 1.5 widths on a tall narrow screen. */
  ref = 1;

  // The dragon, in screen pixels after the camera (y up, from the middle).
  dragonVisible = false;
  /** Where the HEAD is, and the direction of flight: the screen angle of the body axis from tail to head, radians. */
  headX = 0;
  headY = 0;
  /** Radians, the way the head points on the screen (0 right, pi/2 up): up and to the left. */
  heading = 0;
  /** The dragon's length in pixels after the camera. */
  length = 1;
  /** 0 to 1: the shake that builds toward the loss of the grip, and dies away after it. */
  shake = 0;
  /** 0 to 1: how much the dragon hovers (the head crawls), for the wings and the sway. */
  hover = 0;
  /** The head's speed along the path, in pixels per screen of scroll. */
  speed = 0;

  // The doll.
  dollMode: "hidden" | "ride" | "fall" = "hidden";
  /** The doll's hips on the screen and her height there (the fall); the ride is placed by the seat. */
  dollX = 0;
  dollY = 0;
  dollHeight = 1;
  /** Her size while she rides, in pixels (the doll's height on the dragon, before the camera). */
  rideHeight = 1;
  /** 0 to 1 over the move of the fall. */
  move = 0;
  /** From the end of the slow range on: she has let go. */
  fallen = false;

  // The camera of the fall: a 2D camera on the pixel plane (identity until she lets go).
  zoom = 1;
  camX = 0;
  camY = 0;

  /** Where she leaves from, in the world of the bolt: set by the scene from the seat when she lets go. */
  launchX = 0;
  launchY = 0;

  /** The direction of the flight in the world: up and to the left, along the screen's diagonal. */
  private dirX = -1;
  private dirY = 0.5;

  /** The head at path parameter `p`, in the world of the bolt (no camera). */
  private headWorld(p: number, w: number, h: number): void {
    const len = dragonLength(w, h);
    // The longest reach of the screen along the flight, and the dragon's length: the path starts and ends
    // that far from the middle so the whole dragon is beyond the corner.
    const reach = Math.abs(w * 0.5 * this.dirX) + Math.abs(h * 0.5 * this.dirY);
    const half = reach + 0.35 * len;
    const s = (p - 0.5) * 2 * half;
    this.hxW = this.dirX * s;
    this.hyW = this.dirY * s;
  }
  private hxW = 0;
  private hyW = 0;

  /** Fill every field for `u` and a viewport of `w` by `h`. */
  at(u: number, w: number, h: number): this {
    this.w = w;
    this.h = h;
    this.ref = Math.min(h, 1.5 * w);

    // The flight runs along the screen's diagonal, a little flatter than the corners (27 degrees on 16:10).
    const alpha = Math.atan2(h, w) * 0.85;
    this.dirX = -Math.cos(alpha);
    this.dirY = Math.sin(alpha);
    this.heading = Math.atan2(this.dirY, this.dirX);

    const p = pathParam(u);
    this.headWorld(p, w, h);
    const len = dragonLength(w, h);
    this.hover =
      smooth((u - BOLT_AT.slowFrom + 0.2) / 0.6) * (1 - smooth((u - BOLT_AT.slowTo) / 0.5));
    this.speed =
      (headSpeed(u) *
        2 *
        (Math.abs(w * 0.5 * this.dirX) + Math.abs(h * 0.5 * this.dirY) + 0.35 * len)) /
      TOTAL;
    this.shake =
      smooth((u - BOLT_AT.shakeFrom) / (BOLT_AT.lose - BOLT_AT.shakeFrom)) *
      (1 - smooth((u - BOLT_AT.lose - 0.1) / 0.5));
    this.rideHeight = RIDE_SHARE * (len / SIDE_ASPECT);

    // The camera: identity until she lets go.
    const fall = u - BOLT_SCREENS;
    this.zoom = 1;
    this.camX = 0;
    this.camY = 0;
    this.move = clamp01(fall / (FALL_AT.move[1] - FALL_AT.move[0]));
    this.fallen = fall >= 0;
    if (this.fallen) {
      const e = easeInOut(this.move);
      // Where she is in the world: she leaves the seat and drops.
      const wx = this.launchX;
      const wy = this.launchY - FALL_DISTANCE * h * e;
      const zEnd = (END_HEIGHT * h) / this.rideHeight;
      this.zoom = 1 + (zEnd - 1) * e;
      // Her place on the screen goes from the seat to the middle with the same ease.
      const sx = this.launchX * (1 - e);
      const sy = this.launchY * (1 - e);
      this.camX = wx - sx / this.zoom;
      this.camY = wy - sy / this.zoom;
      this.dollX = sx;
      this.dollY = sy;
      this.dollHeight = this.rideHeight * this.zoom;
      this.dollMode = "fall";
    } else {
      this.dollMode = u < BOLT_AT.enter + 0.4 ? "hidden" : "ride";
      this.dollHeight = this.rideHeight;
    }

    const z = this.zoom;
    this.headX = (this.hxW - this.camX) * z;
    this.headY = (this.hyW - this.camY) * z;
    this.length = len * z;
    const margin = this.length * 1.1;
    this.dragonVisible =
      u > BOLT_AT.enter - 0.04 &&
      this.headX > -w / 2 - margin &&
      this.headX < w / 2 + margin &&
      this.headY > -h / 2 - margin &&
      this.headY < h / 2 + margin;
    return this;
  }
}

/** The dragon's length as a multiple of its body block's height (`SilverboltActor.LENGTH_M`: a side view at height h is h * 3.6 long). */
export const SIDE_ASPECT = 3.6;
