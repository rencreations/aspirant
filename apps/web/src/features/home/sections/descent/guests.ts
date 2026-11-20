/**
 * The two Guinevere drones that join the pair in the descent (round nine, 20 Nov 2026). Pure: a
 * function of `p`, the descent's progress (0 at its start, 1 where the pair dock), so the scene
 * is the same both ways: scroll back up and they dance backwards, fly out to the sides and are gone.
 *
 *   0.20 to 0.30  they fly in from the left and the right edge and stop beside the pair
 *   0.30 to 0.37  they bow, the pair look at them (the show's wave is here: `choreo.ts` SHOW)
 *   0.37 to 0.62  they dance with the pair, on the pair's beat
 *   0.62 to 0.66  they float
 *   0.66 to 0.84  they fly out to the edges; they are off the screen from 0.84
 *   0.86          they are no longer drawn (the list is rising and the pair dock from 0.91)
 */
import { clamp01, seg, smooth } from "../vp";

export const GUEST_IN_FROM = 0.2;
export const GUEST_IN_TO = 0.3;
export const GUEST_BOW_TO = 0.37;
export const GUEST_DANCE_FROM = 0.37;
export const GUEST_DANCE_TO = 0.62;
export const GUEST_LEAVE_FROM = 0.66;
export const GUEST_LEAVE_TO = 0.84;
export const GUEST_GONE = 0.86;

export type GuestPose = "leave" | "bow" | "dance" | "float";

export interface GuestState {
  /** False before they come and after they are gone: nothing is drawn. */
  shown: boolean;
  pose: GuestPose;
  /** The pose's weight (for `leave`: 0 at their places, 1 gone). */
  w: number;
  /** 0 to 1: the pair look at them. */
  attention: number;
  /** -1 to 1: which one the pair look at (-1 the left, 1 the right). */
  gaze: number;
}

export const newGuestState = (): GuestState => ({
  shown: false,
  pose: "float",
  w: 0,
  attention: 0,
  gaze: 0,
});

/** What the two do at the descent's progress `p`. Writes `out` and returns it. */
export function guestsAt(p: number, out: GuestState): GuestState {
  out.attention = smooth(seg(p, 0.25, 0.3)) * (1 - smooth(seg(p, 0.37, 0.42)));
  out.gaze = -1 + 2 * smooth(seg(p, 0.3, 0.35));
  out.shown = p >= GUEST_IN_FROM && p < GUEST_GONE;
  if (!out.shown) {
    out.pose = "float";
    out.w = 0;
  } else if (p < GUEST_IN_TO) {
    out.pose = "leave";
    out.w = 1 - smooth(seg(p, GUEST_IN_FROM, GUEST_IN_TO));
  } else if (p < GUEST_BOW_TO) {
    out.pose = "bow";
    out.w = 0.6 * Math.sin(Math.PI * seg(p, GUEST_IN_TO, GUEST_BOW_TO)) ** 2;
  } else if (p < GUEST_DANCE_TO) {
    out.pose = "dance";
    out.w =
      smooth(seg(p, GUEST_DANCE_FROM, GUEST_DANCE_FROM + 0.04)) *
      (1 - smooth(seg(p, GUEST_DANCE_TO - 0.04, GUEST_DANCE_TO)));
  } else if (p < GUEST_LEAVE_FROM) {
    out.pose = "float";
    out.w = 1;
  } else {
    out.pose = "leave";
    out.w = smooth(seg(p, GUEST_LEAVE_FROM, GUEST_LEAVE_TO));
  }
  return out;
}

/**
 * The duo's dance has four phrases of three seconds; the third is a fist bump in the middle, which would
 * happen behind the pair. The clock skips it: phrases 1, 2 and 4, each of which begins and ends at rest,
 * so there is no seam. `tau` is the seconds of dance (any real number, a reverse scroll runs it back).
 */
export function danceClock(tau: number): number {
  const loop = 9;
  const turns = Math.floor(tau / loop);
  const at = tau - turns * loop;
  return turns * 12 + at + (at >= 6 ? 3 : 0);
}

/** Where the two stand, beside the pair: the side distance and the ball's size, in the pair's drone heights. */
export const GUEST_SIDE = 2.0;
export const GUEST_BALL = 0.62;

export interface GuestPlace {
  x: number;
  y: number;
  height: number;
}

/**
 * The place of one guest (`side` -1 the left, 1 the right) beside a pair whose drone is at `x`, `y` with the
 * height `h` (stage pixels, y up), kept on the screen of width `w` so a pair at the edge does not push
 * a guest out of sight. `lift` raises them a little (a greeting).
 */
export function guestPlace(
  side: -1 | 1,
  x: number,
  y: number,
  h: number,
  w: number,
  lift: number,
  out: GuestPlace,
): GuestPlace {
  const ball = GUEST_BALL * h;
  // A glove reaches about 1.7 radii from the ball: keep the whole drone on the screen.
  const margin = 2.8 * (ball / 2);
  const reach = Math.max(0, w / 2 - margin);
  out.x = Math.max(-reach, Math.min(reach, x + side * GUEST_SIDE * h));
  out.y = y + (0.08 + 0.12 * clamp01(lift)) * h;
  out.height = ball;
  return out;
}
