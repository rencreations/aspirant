/**
 * The two Guinevere drones that join the pair in the descent (round nine, 20 Nov 2026). Pure.
 *
 * A VISIT, not a scrub. The scroll only decides whether they are wanted (`visitWanted`: from 20 percent
 * of the descent to 60 percent). Their flights in and out are timed, speed limited and eased, and
 * their bow and their dance run on their own clock from the moment they stand beside the pair. So
 * however fast the visitor scrolls, a flight never moves a guest by more than a smooth flight shows
 * (the whole way out to an edge takes `GUEST_FLY` seconds), they are never snapped in or out, and the
 * pair's greeting is timed to their arrival and not to a beat that lags a quick scroll. A reverse
 * scroll sends them out again the same way. The dance itself is on the pair's beat (`runtime.ts`).
 *
 *   arrive   the flight in from the edges (the `leave` pose played back), `GUEST_FLY` seconds
 *   bow      `GUEST_BOW` seconds: they bow, the pair wave and look at them
 *   dance    on the pair's beat, as long as they are wanted
 *   stop     the dance eases out over `GUEST_STOP` seconds, then they float and fly out
 */
import { dampTo, setDamped, type Damped } from "../../actors/buddies/smooth";
import { clamp01, seg, smooth } from "../vp";

/** The share of the descent where they are wanted: they come at 20 percent, leave before the dock. */
export const GUEST_IN_FROM = 0.2;
export const GUEST_OUT_FROM = 0.6;
/** Seconds of a whole flight in or out (under 1.5 percent of the screen's height a frame). */
export const GUEST_FLY = 2.5;
/** Seconds of the bow and the greeting, from the moment they stand beside the pair. */
export const GUEST_BOW = 1.6;
/** Seconds the dance takes to come in and to go out. */
export const GUEST_DANCE_IN = 0.6;
export const GUEST_STOP = 0.45;
/** Seconds of the pair's greeting wave (the bow and a little after). */
const GREET = GUEST_BOW + 0.8;

export type GuestPose = "leave" | "bow" | "dance" | "float";

/** Whether the descent's progress `p` wants the guests here. */
export const visitWanted = (p: number): boolean => p >= GUEST_IN_FROM && p < GUEST_OUT_FROM;

export interface Visit {
  /** How far in they are, 0 (off the screen) to 1 (beside the pair): the flight's own follower. */
  flight: Damped;
  /** Seconds they have stood beside the pair (0 while they fly). */
  stood: number;
  /** The dance's weight, 0 to 1. */
  perform: number;
  /** False while nobody is drawn. */
  shown: boolean;
  /** The pose and its weight (for `leave`: 0 at their places, 1 gone). */
  pose: GuestPose;
  w: number;
  /** 0 to 1: the pair look at them. */
  attention: number;
  /** -1 to 1: which one the pair look at (-1 the left, 1 the right). */
  gaze: number;
  /** 0 to 1: the pair's greeting wave. */
  greet: number;
  /** True on the one frame the dance begins (the pair's beat is marked then). */
  danceFrom: boolean;
}

export const newVisit = (): Visit => ({
  flight: { x: 0, v: 0 },
  stood: 0,
  perform: 0,
  shown: false,
  pose: "float",
  w: 0,
  attention: 0,
  gaze: 0,
  greet: 0,
  danceFrom: false,
});

/** Back to the start: nobody is here (a section that is left). */
export function resetVisit(v: Visit): void {
  setDamped(v.flight, 0);
  v.stood = 0;
  v.perform = 0;
  v.shown = false;
  v.pose = "float";
  v.w = 0;
  v.attention = 0;
  v.gaze = 0;
  v.greet = 0;
  v.danceFrom = false;
}

/**
 * One step of the visit. `wanted` is `visitWanted(p)`. Every number it writes is continuous in time.
 * The flight has its own limit: it never goes faster than `1 / GUEST_FLY` of the whole way in a second.
 */
export function stepVisit(v: Visit, wanted: boolean, dt: number): Visit {
  if (dt <= 0) return v;
  const standing = v.flight.x >= 0.999;
  v.stood = standing ? v.stood + dt : 0;
  const was = v.perform;
  // The dance comes in after the bow; it goes out first when they are no longer wanted.
  const danceWanted = wanted && standing && v.stood >= GUEST_BOW;
  v.perform = clamp01(v.perform + (danceWanted ? dt / GUEST_DANCE_IN : -dt / GUEST_STOP));
  v.danceFrom = was <= 0 && v.perform > 0;
  // They fly out only when they have stopped dancing, and in as soon as they are wanted.
  const flightGoal = wanted || v.perform > 0.001 ? 1 : 0;
  dampTo(v.flight, flightGoal, 0.35, 1 / GUEST_FLY, dt);
  v.shown = v.flight.x > 0.0005;
  if (!v.shown) {
    v.pose = "float";
    v.w = 0;
  } else if (v.flight.x < 0.999) {
    v.pose = "leave";
    v.w = 1 - smooth(v.flight.x);
  } else if (v.perform > 0.001) {
    v.pose = "dance";
    v.w = smooth(v.perform);
  } else if (v.stood < GUEST_BOW && wanted) {
    v.pose = "bow";
    v.w = 0.6 * Math.sin(Math.PI * clamp01(v.stood / GUEST_BOW)) ** 2;
  } else {
    v.pose = "float";
    v.w = 1;
  }
  const arrived = smooth(seg(v.flight.x, 0.7, 1));
  v.attention = arrived * (1 - smooth(seg(v.stood, GUEST_BOW, GUEST_BOW + 0.5)));
  v.gaze = -1 + 2 * smooth(seg(v.stood, 0.25, GUEST_BOW - 0.25));
  v.greet = Math.sin(Math.PI * clamp01(v.stood / GREET)) ** 2;
  return v;
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
