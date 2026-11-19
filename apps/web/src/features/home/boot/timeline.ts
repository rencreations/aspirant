/**
 * The intro of the home page as a pure function of time. `introAt(t, geo, out)` writes, for the
 * `t` seconds since the visitor pressed "Touch anywhere to continue", the target state of every
 * actor: the normal drone, the two Guinevere drones, the big logo. The runner (`runtime.ts`) hands
 * the state to the actors every frame and fires the one-shot cues of `CUES` when the clock crosses
 * them. Nothing here reads the DOM, three.js or the clock, so the whole opening is tested.
 *
 * Round two (19 Nov 2026): the owner asked for the whole set up in two seconds at most, counted from
 * the press to the first frame of the hero. The story is the owner's and it is kept, at speed, with
 * every beat overlapping the next:
 *
 *   a  the two Guinevere drones swoop in from the left carrying the logo. It is stiff: no sag, no
 *      wobble, no struggle
 *   b  the normal drone sees them (the one comic mark of the opening) and dashes under the logo
 *   c  the three set the logo down in the middle
 *   d  the pair take its two corners and pull it to the hero width; the drone steps back to its
 *      place at rest
 *   e  the pair leave. The big logo and the drone are exactly where the hero starts (joint J0)
 *
 * Stage pixels, y up, the origin in the middle of the screen.
 */
import { clamp01, mix } from "@/features/about/choreo/ease";

import { span } from "../actors/duo/curves";
import { newRoutePlace, routeAt } from "../drone-route";
import { ART, ART_ASPECT, SOCKETS, heroRect } from "../fx/logo/math";

/**
 * The seconds of each beat since the press. The whole intro is `INTRO_SECONDS`, 1.85 s: the owner's
 * two seconds, less the first frames of a real load. A test holds the order of the beats and the length.
 */
export const T = {
  /** The loading words and the bar are gone by here (DOM). */
  uiOut: 0.2,
  /** The pair and the logo swoop in from the left and reach the middle. */
  swoop: [0, 0.58],
  /** The normal drone sees them. */
  shock: 0.14,
  /** The normal drone dashes under the logo. */
  dash: [0.18, 0.5],
  /** The carry is let go and the logo stands by itself. */
  putDown: [0.58, 0.76],
  /** The pair take the logo's corners. */
  pull: 0.76,
  /** The logo grows to the hero width. */
  grow: [0.84, 1.4],
  /** The drone steps back to its place at rest. */
  droneBack: [0.88, 1.5],
  /** The pair leave. */
  leave: [1.35, 1.8],
  /** The intro ends here, on joint J0. */
  end: 1.85,
} as const;

/** The big logo stands still at rest. It is the hero's own (`REST_WAVE` in `sections/hero/runtime.ts`): the two must match. */
export const LOGO_REST_WAVE = 0;

/** The length of the intro in seconds: from the press to the first frame of the hero. */
export const INTRO_SECONDS = T.end;

export interface IntroGeo {
  /** The viewport in CSS pixels. */
  w: number;
  h: number;
}

type DroneFaceName = "shocked" | "determined" | "happy" | "proud";

interface Vec {
  x: number;
  y: number;
}

interface Place extends Vec {
  height: number;
}

/** What the intro asks of every actor for one time. Made once, written every frame. */
export interface IntroState {
  /** The loading screen's words are gone (0 shown, 1 gone), for the DOM. */
  ui: number;

  droneOn: boolean;
  drone: Place;
  /** "peek" or none. */
  dronePose: "peek" | null;
  /** The side the drone peeks at: -1 left. */
  droneSide: number;
  droneFace: DroneFaceName | null;
  /** The drone looks at this point (stage pixels), or at the pointer when `lookPointer`. */
  lookPointer: boolean;
  look: Vec;

  duoOn: boolean;
  /** "carry" with `carry`, "pull" with `pull`, then "leave" with `poseW`. */
  duoMode: "carry" | "pull" | "leave";
  carry: { x: number; y: number; width: number; tension: number; struggle: number; lift: number };
  pull: { cx: number; cy: number; w: number; h: number; strain: number };
  /** Where the pair stand when they leave, and how big their balls are. */
  duoA: Place;
  duoB: Place;
  /** The progress of the leaving, 0 at their places to 1 gone. */
  poseW: number;
  leaveA: Vec;
  leaveB: Vec;

  logoOn: boolean;
  /** 1 while the pair's hands carry it, 0 when it stands by itself (blended between). */
  logoCarried: number;
  /** Where it stands (the art box's middle and width), used at `logoCarried` 0. */
  logo: { cx: number; cy: number; width: number };
  logoTension: number;
  logoWobble: number;
  logoWave: number;
}

export function newIntroState(): IntroState {
  const place = (): Place => ({ x: 0, y: 0, height: 0 });
  return {
    ui: 0,
    droneOn: false,
    drone: place(),
    dronePose: null,
    droneSide: -1,
    droneFace: null,
    lookPointer: true,
    look: { x: 0, y: 0 },
    duoOn: false,
    duoMode: "carry",
    carry: { x: 0, y: 0, width: 0, tension: 1, struggle: 0, lift: 0 },
    pull: { cx: 0, cy: 0, w: 0, h: 0, strain: 0 },
    duoA: place(),
    duoB: place(),
    poseW: 0,
    leaveA: { x: -1, y: -0.55 },
    leaveB: { x: 1, y: 0.55 },
    logoOn: false,
    logoCarried: 0,
    logo: { cx: 0, cy: 0, width: 0 },
    logoTension: 1,
    logoWobble: 0,
    logoWave: 0,
  };
}

// ----------------------------------------------------------------------------------------------
// Sizes

/** The loader's drone is this share of the screen's height, and stands in the middle of it. */
export const LOADER_DRONE = 0.12;

/**
 * Where the loading screen keeps the drone: the middle of the screen, a small drone (12 percent of
 * the window's height, never wider than a third of its width). The bar and the words stand under it
 * (`components/home-boot/home-boot.module.css`, which reads the same 6.4 percent for the drone's
 * half height with its silhouette).
 */
export function loaderPlace(geo: IntroGeo, out: Place): Place {
  out.x = 0;
  out.y = 0;
  out.height = Math.max(48, Math.min(LOADER_DRONE * geo.h, 0.3 * geo.w));
  return out;
}

/** From a grip to the farthest part of a drone that holds it (its glove or an ear), in balls' radii. */
const CARRY_REACH = 3.92;

/**
 * The ball of a Guinevere drone (a diameter), in pixels: a part of the window's height or width, and
 * never so big that the two of them and the logo between them leave the screen while they carry
 * (from the moment they are in to the moment they take the corners; `timeline.test.ts` holds it).
 */
export function duoBall(geo: IntroGeo): number {
  const base = Math.min(0.15 * geo.h, (geo.w < 700 ? 0.15 : 0.19) * geo.w);
  const span = carriedWidth(geo) * GRIP_SPAN;
  const room = geo.w / 2 - span / 2;
  return Math.max(36, Math.min(base, (2 * room) / CARRY_REACH));
}

/** The ball of a Guinevere drone once they pull: smaller, so an arm's length still fits the screen. */
function pullBall(geo: IntroGeo): number {
  return Math.min(0.115 * geo.h, 0.15 * geo.w);
}

/** The logo's art width while it is carried. */
export function carriedWidth(geo: IntroGeo): number {
  return 0.44 * heroRect(geo.w, geo.h).width;
}

/** The distance between the two grips of the logo, as a part of its art width. */
export const GRIP_SPAN = (SOCKETS.right.x - SOCKETS.left.x) / ART.w;

/** The rectangle between the logo's two pulled corners (its `bl` and `tr` sockets) for an art width. */
export function pullRectFor(
  cx: number,
  cy: number,
  width: number,
  out: { cx: number; cy: number; w: number; h: number },
): typeof out {
  const k = width / ART.w;
  out.cx = cx + (k * (SOCKETS.bl.x + SOCKETS.tr.x)) / 2;
  out.cy = cy + (k * (SOCKETS.bl.y + SOCKETS.tr.y)) / 2;
  out.w = k * (SOCKETS.tr.x - SOCKETS.bl.x);
  out.h = k * (SOCKETS.tr.y - SOCKETS.bl.y);
  // The sockets are the corners of a rectangle that runs up to the right: the height is positive
  // for the pull, whatever the art's own heights.
  out.h = Math.abs(out.h);
  return out;
}

// ----------------------------------------------------------------------------------------------
// Easing

const smooth = (u: number): number => u * u * (3 - 2 * u);
const sm = (t: number, a: number, b: number): number => smooth(span(t, a, b));
const easeOut = (u: number): number => 1 - Math.pow(1 - clamp01(u), 2.6);
const easeInOut = (u: number): number => {
  const v = clamp01(u);
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
};

/** How far behind the logo's target the carried logo really is (the pair follow it on springs), in seconds. */
const DRONE_LAG = 0.14;

const route0 = newRoutePlace();
const loader: Place = { x: 0, y: 0, height: 0 };
const pullBox = { cx: 0, cy: 0, w: 0, h: 0 };

/**
 * The state of the intro at `t` seconds. Writes into `out` and returns it. Pure: the same `t` and
 * `geo` give the same state, and nothing is allocated.
 */
export function introAt(t: number, geo: IntroGeo, out: IntroState): IntroState {
  const { w, h } = geo;
  const rest = heroRect(w, h);
  const W1 = rest.width;
  const W0 = carriedWidth(geo);
  const ball = duoBall(geo);
  const cyRest = rest.cy;

  out.ui = sm(t, 0, T.uiOut);

  // --- the logo's width and where its centre is going: it swoops in from the left and stops in the
  // middle. It grows in one smooth move, no overshoot: it is stiff.
  const width = mix(W0, W1, easeInOut(span(t, T.grow[0], T.grow[1])));
  const x0 = -(w / 2) - W0 / 2 - 2.6 * ball;
  const swoopX = (at: number): number => mix(x0, 0, easeOut(span(at, T.swoop[0], T.swoop[1])));
  const carryX = swoopX(t);

  // --- the pair
  out.duoOn = t > 0 && t < T.leave[1];
  const set = sm(t, T.putDown[0], T.putDown[1]);
  out.carry.x = carryX;
  out.carry.y = cyRest;
  out.carry.width = W0 * GRIP_SPAN;
  out.carry.tension = 0.7;
  out.carry.struggle = 0;
  // They hold it a little high and let it down as they set it in the middle.
  out.carry.lift = 0.3 * (1 - set);

  // The pull takes the logo's two corners, the rectangle grows with the logo.
  pullRectFor(0, cyRest, width, pullBox);
  out.pull.cx = pullBox.cx;
  out.pull.cy = pullBox.cy;
  out.pull.w = pullBox.w;
  out.pull.h = pullBox.h;
  out.pull.strain =
    0.3 + 0.4 * sm(t, T.grow[0] - 0.1, T.grow[0] + 0.25) * (1 - sm(t, T.grow[1] - 0.2, T.leave[0]));

  // Where the pair stand when they leave: below the logo's left end and above its right end, inside
  // the screen. Their balls are smaller than when they carried: an arm of the pull is about three
  // radii long, and the grown logo leaves little room at its sides.
  const small = pullBall(geo);
  const H1 = W1 / ART_ASPECT;
  const ballNow = mix(ball, small, sm(t, T.pull, T.pull + 0.4));
  out.duoA.x = -0.3 * w;
  out.duoA.y = cyRest - H1 / 2 - 0.9 * small;
  out.duoA.height = ballNow;
  out.duoB.x = 0.3 * w;
  out.duoB.y = cyRest + H1 / 2 + 0.9 * small;
  out.duoB.height = ballNow;
  if (t < T.pull) out.duoMode = "carry";
  else if (t < T.leave[0]) out.duoMode = "pull";
  else out.duoMode = "leave";
  out.poseW = out.duoMode === "leave" ? span(t, T.leave[0], T.leave[1]) : 0;

  // --- the logo: stiff. Taut between the hands, no wobble, no wave, then still.
  out.logoOn = t > 0;
  out.logoCarried = 1 - set;
  out.logo.cx = 0;
  out.logo.cy = cyRest;
  out.logo.width = t < T.pull ? W0 : width;
  out.logoTension = 1;
  out.logoWobble = 0;
  out.logoWave = LOGO_REST_WAVE;

  // --- the normal drone: it stands in the middle, sees the pair, dashes under the logo, and when
  // the logo is set steps back to its place at rest.
  const j0 = routeAt(0, geo, route0);
  loaderPlace(geo, loader);
  const dash = sm(t, T.dash[0], T.dash[1]);
  const back = sm(t, T.droneBack[0], T.droneBack[1]);
  const dh = 0.13 * h;
  const logoH = (t < T.pull ? W0 : width) / ART_ASPECT;
  // The pair's hands follow the logo's target on springs, a little behind: the drone goes to where
  // the logo actually is, not to where it is going.
  const underX = swoopX(t - DRONE_LAG);
  const underY = cyRest - logoH / 2 - 0.62 * dh;
  const toPlace = (a: number, b: number, c: number): number => mix(mix(a, b, dash), c, back);
  out.droneOn = true;
  out.drone.x = toPlace(loader.x, underX, j0.x);
  out.drone.y = toPlace(loader.y, underY, j0.y);
  out.drone.height = toPlace(loader.height, dh, j0.height);

  out.dronePose = t >= 0.05 && t < T.dash[0] + 0.1 ? "peek" : null;
  out.droneSide = -1;
  out.droneFace =
    t >= T.shock && t < T.dash[1]
      ? "shocked"
      : t >= T.dash[1] && t < T.droneBack[0] + 0.1
        ? "determined"
        : t >= T.grow[0] && t < T.end - 0.3
          ? "proud"
          : null;
  out.lookPointer = t >= T.droneBack[1] || t < 0;
  out.look.x = carryX;
  out.look.y = cyRest;
  return out;
}

// ----------------------------------------------------------------------------------------------
// One-shot cues

export type IntroCue =
  | { at: number; kind: "shock" }
  | { at: number; kind: "blip"; sound: "click" | "whoosh" | "star" | "confirm" };

/**
 * The things that happen once, in time order. The only comic mark of the opening is the shock mark
 * over the drone's head when it sees the pair (the owner's call: the necessary marks only).
 */
export const CUES: readonly IntroCue[] = (
  [
    { at: 0.02, kind: "blip", sound: "click" },
    { at: 0.08, kind: "blip", sound: "whoosh" },
    { at: T.shock, kind: "shock" },
    { at: T.grow[1] - 0.1, kind: "blip", sound: "star" },
    { at: T.end - 0.05, kind: "blip", sound: "confirm" },
  ] satisfies IntroCue[]
).sort((a, b) => a.at - b.at);

/** The cues whose time is in `(from, to]`, in order, handed to `fire`. */
export function cuesBetween(from: number, to: number, fire: (cue: IntroCue) => void): void {
  for (const cue of CUES) {
    if (cue.at > from && cue.at <= to) fire(cue);
  }
}

// ----------------------------------------------------------------------------------------------
// The logo between two hands

export interface CarriedRect {
  cx: number;
  cy: number;
  width: number;
  /** Radians, anticlockwise. */
  roll: number;
}

/**
 * Where the logo is when two hands hold its `left` and `right` sockets at `pa` and `pb` (stage
 * pixels): the same arithmetic as `rectFromGrabs`, written into `out` so nothing is allocated.
 */
export function carriedRect(pa: Vec, pb: Vec, out: CarriedRect): CarriedRect {
  const a = SOCKETS.left;
  const b = SOCKETS.right;
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  const reach = Math.hypot(pb.x - pa.x, pb.y - pa.y);
  const k = chord > 0 ? reach / chord : 1;
  const roll = Math.atan2(pb.y - pa.y, pb.x - pa.x) - Math.atan2(b.y - a.y, b.x - a.x);
  const cs = Math.cos(roll);
  const sn = Math.sin(roll);
  out.cx = pa.x - k * (a.x * cs - a.y * sn);
  out.cy = pa.y - k * (a.x * sn + a.y * cs);
  out.width = k * ART.w;
  out.roll = roll;
  return out;
}
