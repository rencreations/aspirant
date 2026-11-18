/**
 * The intro of the home page as a pure function of time. `introAt(t, geo, out)` writes, for the
 * `t` seconds since the visitor pressed "Touch anywhere to continue", the target state of every
 * actor: the normal drone, the two Guinevere drones, the big logo. The runner (`runtime.ts`) hands
 * the state to the actors every frame and fires the one-shot cues of `CUES` when the clock crosses
 * them. Nothing here reads the DOM, three.js or the clock, so the whole opening is tested.
 *
 * The beats are the owner's, in order (design section 4.1, joint J0):
 *
 *   a  the two Guinevere drones fly in from the left carrying the logo and STRUGGLE: it hangs, they
 *      heave, one end sags, they drop it and try again
 *   b  the normal drone is shocked, then goes under the logo and helps: they carry it to the middle
 *   c  the normal drone steps to the corner (its place at rest); the two drones take the logo by
 *      two corners and pull it bigger, to the hero width
 *   d  the normal drone thanks them with icons only; they bow, and leave
 *   e  the big logo and the drone at the lower right: exactly where the hero starts (J0)
 *
 * Stage pixels, y up, the origin in the middle of the screen.
 */
import { clamp01, mix } from "@/features/about/choreo/ease";

import { key, span, type Key } from "../actors/duo/curves";
import { newRoutePlace, routeAt } from "../drone-route";
import { ART, ART_ASPECT, SOCKETS, heroRect } from "../fx/logo/math";

/** The seconds of each beat since the press. */
export const T = {
  /** The loading words and the bar are gone by here (DOM). */
  uiOut: 0.5,
  /** The drone leaves the loader's place for its corner. */
  droneMove: [0, 1.0],
  /** The pair and the logo begin to come in from the left. */
  enter: 0.9,
  /** The normal drone sees them. */
  shock: 1.85,
  /** The normal drone goes under the logo. */
  helpFly: [3.55, 4.55],
  /** Its help takes the weight off. */
  help: [4.3, 5.1],
  /** The three carry the logo to the middle. */
  toMiddle: [5.1, 6.8],
  /** The carry is let go and the logo stands by itself. */
  putDown: [6.5, 6.9],
  /** The drone steps back to its corner. */
  helpBack: [6.8, 7.7],
  /** The pair take the corners. */
  pull: 7.0,
  /** The logo grows to the hero width. */
  grow: [7.7, 9.4],
  /** The drone thanks, the pair bow. */
  thanks: 9.65,
  bow: [9.7, 10.25],
  /** The pair leave. */
  leave: [11.15, 12.45],
  /** What remains is held for a moment: the intro ends here. */
  end: 13.2,
} as const;

/** The calm ripple of the big logo at rest. It is the hero's own (`REST_WAVE` in `sections/hero/runtime.ts`): the two must match. */
export const LOGO_REST_WAVE = 0.3;

/** The length of the intro in seconds. */
export const INTRO_SECONDS = T.end;

/** The part of the intro after the pair are gone: a skip jumps to here and lets the springs rest. */
export const SETTLE_SECONDS = 0.7;

export interface IntroGeo {
  /** The viewport in CSS pixels. */
  w: number;
  h: number;
}

type DroneFaceName = "shocked" | "sweat" | "determined" | "happy" | "proud" | "confused";
type DroneIcon = "heart" | "sparkle" | "smile" | "thanks";

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
  /** "peek", "thanks" or none. */
  dronePose: "peek" | "thanks" | null;
  /** The side the drone peeks at: -1 left. */
  droneSide: number;
  droneFace: DroneFaceName | null;
  /** The drone looks at this point (stage pixels), or at the pointer when `lookPointer`. */
  lookPointer: boolean;
  look: Vec;

  duoOn: boolean;
  /** "carry" with `carry`, "pull" with `pull`, then the two named poses with `poseW`. */
  duoMode: "carry" | "pull" | "bow" | "leave";
  carry: { x: number; y: number; width: number; tension: number; struggle: number; lift: number };
  pull: { cx: number; cy: number; w: number; h: number; strain: number };
  /** Where the pair stand for `bow` and `leave`, and how big their balls are. */
  duoA: Place;
  duoB: Place;
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

  /** 0 to 1: the normal drone's help (for the pair's strain). */
  help: number;
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
    help: 0,
  };
}

// ----------------------------------------------------------------------------------------------
// Sizes

/**
 * How far the top of the loading screen's mark (`THE ASPIRANTS`) stands above the middle of the
 * screen, in pixels. The screen centres its block (mark, bar, words), so this follows from the
 * mark's size: `clamp(1.4rem, 5vw, 2.2rem)` (22.4 to 35.2 px). Fitted to the measured screen: 47.5
 * at 1440 wide and 36.8 at 390 wide.
 */
export function markTop(w: number): number {
  const font = Math.min(35.2, Math.max(22.4, 0.05 * w));
  return 18.2 + 0.832 * font;
}

/** The clear space between the drone's lowest point and the mark (px). */
const LOADER_GAP = 26;
/** The drawn drone is this much taller than its `height` (wings, antennae, the ink line). */
const SILHOUETTE = 1.06;

/**
 * Where the loading screen keeps the drone: in the middle, standing on a clear gap above the mark
 * whatever the shape of the window, as big as the window allows (a quarter of its height at most).
 */
export function loaderPlace(geo: IntroGeo, out: Place): Place {
  const floor = markTop(geo.w) + LOADER_GAP;
  const fit = (geo.h / 2 - 24 - floor) / SILHOUETTE;
  out.x = 0;
  out.height = Math.max(60, Math.min(0.26 * geo.h, 0.46 * geo.w, fit));
  out.y = floor + out.height / 2;
  return out;
}

/**
 * Where the logo hangs while the pair fight with it, left of the middle (pixels, negative). A phone
 * has no room to spare, a wide screen shows the struggle best a little off centre.
 */
function stuckX(w: number): number {
  if (w < 700) return -0.03 * w;
  return -mix(0.04, 0.16, clamp01((w - 768) / (1440 - 768))) * w;
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
  const room = geo.w / 2 - Math.abs(stuckX(geo.w)) - span / 2;
  return Math.max(36, Math.min(base, (2 * room) / CARRY_REACH));
}

/** The ball of a Guinevere drone once they pull: smaller, so an arm's length still fits the screen. */
function pullBall(geo: IntroGeo): number {
  return Math.min(0.115 * geo.h, 0.15 * geo.w);
}

/** The logo's art width while it is carried, and when it has grown. */
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
// The curves of the carry (the opening's struggle, timed to this intro)

/** Seconds since the pair began to carry (`T.enter`). The drop is at 2.45 s. */
const STRUGGLE: readonly Key[] = [
  [0, 0.3],
  [0.9, 0.5],
  [1.7, 0.8],
  [2.3, 1.0],
  [2.6, 0.9],
  [3.3, 0.95],
  [3.7, 1.0],
  [4.5, 0.85],
];
const LIFT: readonly Key[] = [
  [0, 0.35],
  [1.2, 0.3],
  [1.8, 0.1],
  [2.2, 0.45, "out"],
  [2.45, -0.7, "in"],
  [2.9, -0.55],
  [3.4, 0.0],
  [3.8, 0.35, "back"],
  [4.8, 0.15],
];
const TENSION: readonly Key[] = [
  [0, 0.35],
  [1.8, 0.75],
  [2.3, 0.95],
  [3.8, 1.0],
  [4.6, 0.9],
];

/** The drop of the logo: the moment the lift falls (seconds since the press). */
export const DROP_AT = T.enter + 2.45;

const smooth = (u: number): number => u * u * (3 - 2 * u);
const sm = (t: number, a: number, b: number): number => smooth(span(t, a, b));
const easeOut = (u: number): number => 1 - Math.pow(1 - clamp01(u), 2.2);

/** A little past the end and back: the logo snaps to size when the pair have pulled. */
function snapGrow(u: number): number {
  const v = clamp01(u);
  const s = 1 - Math.pow(1 - v, 3);
  return s + 0.035 * Math.sin(Math.PI * v) * (1 - v) * 3;
}

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

  // --- the logo's width and where its centre is going
  const grow = snapGrow(span(t, T.grow[0], T.grow[1]));
  const width = mix(W0, W1, grow);
  const x0 = -(w / 2) - W0 / 2 - 2.6 * ball;
  const xStuck = stuckX(w);
  const carryX =
    t < T.toMiddle[0]
      ? mix(x0, xStuck, easeOut(span(t, T.enter, 4.1)))
      : mix(xStuck, 0, sm(t, T.toMiddle[0], T.toMiddle[1]));

  // --- the help of the normal drone
  const help = sm(t, T.help[0], T.help[1]);
  out.help = help;

  // --- the pair
  const tc = t - T.enter;
  out.duoOn = t >= T.enter - 0.2 && t < T.leave[1];
  const struggle = key(tc, STRUGGLE) * (1 - 0.85 * help);
  const tension = key(tc, TENSION) * (1 - help) + 0.6 * help;
  const lift = (key(tc, LIFT) * (1 - help) + 0.45 * help) * (1 - sm(t, T.putDown[0], T.putDown[1]));
  out.carry.x = carryX;
  out.carry.y = cyRest;
  out.carry.width = W0 * GRIP_SPAN;
  out.carry.tension = tension;
  out.carry.struggle = struggle;
  out.carry.lift = lift;

  // The pull takes the logo's two corners, the rectangle grows with the logo.
  pullRectFor(0, cyRest, width, pullBox);
  out.pull.cx = pullBox.cx;
  out.pull.cy = pullBox.cy;
  out.pull.w = pullBox.w;
  out.pull.h = pullBox.h;
  out.pull.strain = 0.25 + 0.75 * sm(t, T.grow[0] - 0.1, T.grow[0] + 0.5) * (1 - sm(t, 9.2, 9.7));

  // Where the pair stand when they bow and leave: below the logo's left end and above its right
  // end, inside the screen so the thanks is seen. Their balls are smaller than when they carried:
  // an arm of the pull is about three radii long, and the grown logo leaves little room at its sides.
  const small = pullBall(geo);
  const H1 = W1 / ART_ASPECT;
  const ballNow = mix(ball, small, sm(t, T.pull, T.pull + 0.6));
  out.duoA.x = -0.3 * w;
  out.duoA.y = cyRest - H1 / 2 - 0.9 * small;
  out.duoA.height = ballNow;
  out.duoB.x = 0.3 * w;
  out.duoB.y = cyRest + H1 / 2 + 0.9 * small;
  out.duoB.height = ballNow;
  if (t < T.pull) out.duoMode = "carry";
  else if (t < T.thanks - 0.15) out.duoMode = "pull";
  else if (t < T.leave[0]) out.duoMode = "bow";
  else out.duoMode = "leave";
  out.poseW =
    out.duoMode === "bow"
      ? sm(t, T.bow[0], T.bow[1]) * (1 - sm(t, T.leave[0] - 0.45, T.leave[0]))
      : out.duoMode === "leave"
        ? span(t, T.leave[0], T.leave[1])
        : 0;

  // --- the logo
  out.logoOn = t >= T.enter - 0.2;
  out.logoCarried = 1 - sm(t, T.putDown[0], T.putDown[1]);
  out.logo.cx = 0;
  out.logo.cy = cyRest;
  out.logo.width = t < T.pull ? W0 : width;
  // The logo hangs loose while they strain, and sags deep when they drop it.
  const sag = clamp01(0.18 + 0.5 * struggle + 0.4 * Math.max(0, -lift)) * (1 - 0.85 * help);
  out.logoTension = mix(1 - sag, 1, sm(t, T.putDown[0], T.putDown[1] + 0.4));
  out.logoWobble = Math.sin(tc * 3.4) * struggle * 0.8 * (1 - help);
  // A ripple runs along the logo while it is pulled, then it settles into the calm ripple the hero
  // starts with (joint J0: the logo is not flat at the end of the intro and wavy a frame later).
  out.logoWave =
    0.55 * Math.sin(Math.PI * span(t, T.grow[0] + 0.1, T.grow[1])) ** 2 +
    LOGO_REST_WAVE * sm(t, T.grow[1], T.leave[1]);

  // --- the normal drone
  const j0 = routeAt(0, geo, route0);
  loaderPlace(geo, loader);
  const move = sm(t, T.droneMove[0], T.droneMove[1]);
  const fly = sm(t, T.helpFly[0], T.helpFly[1]);
  const back = sm(t, T.helpBack[0], T.helpBack[1]);
  const dh = 0.13 * h;
  const logoH = (t < T.pull ? W0 : width) / ART_ASPECT;
  const underX = carryX;
  const underY = cyRest - logoH / 2 - 0.3 * dh;
  const toCorner = (a: number, b: number, c: number): number => mix(mix(a, b, fly), c, back);
  out.droneOn = true;
  out.drone.x = toCorner(mix(loader.x, j0.x, move), underX, j0.x);
  out.drone.y = toCorner(mix(loader.y, j0.y, move), underY, j0.y);
  out.drone.height = toCorner(mix(loader.height, j0.height, move), dh, j0.height);

  out.dronePose =
    t >= T.thanks && t < T.leave[0] + 0.2
      ? "thanks"
      : (t >= 0.5 && t < T.helpFly[0]) || (t >= T.pull + 0.2 && t < T.thanks - 0.1)
        ? "peek"
        : null;
  out.droneSide = -1;
  out.droneFace =
    t >= T.helpFly[1] - 0.4 && t < T.helpBack[0]
      ? "determined"
      : t >= DROP_AT + 0.1 && t < T.helpFly[0] + 0.2
        ? "sweat"
        : t >= T.grow[1] - 0.2 && t < T.thanks - 0.1
          ? "proud"
          : null;
  out.lookPointer = t >= T.thanks || t < 0;
  out.look.x = carryX;
  out.look.y = cyRest;
  return out;
}

// ----------------------------------------------------------------------------------------------
// One-shot cues

export type IntroCue =
  | { at: number; kind: "shock" }
  | { at: number; kind: "dropBang" }
  | { at: number; kind: "droneSweat" }
  | { at: number; kind: "bubble"; icon: DroneIcon }
  | { at: number; kind: "duoReact"; react: "cheer" | "shy" | "giggle" }
  | { at: number; kind: "burst" }
  | { at: number; kind: "hearts" }
  | { at: number; kind: "blip"; sound: "click" | "whoosh" | "star" | "confirm" };

/** The things that happen once, in time order. */
export const CUES: readonly IntroCue[] = (
  [
    { at: 0.05, kind: "blip", sound: "click" },
    { at: T.enter + 0.2, kind: "blip", sound: "whoosh" },
    { at: T.shock, kind: "shock" },
    { at: DROP_AT, kind: "dropBang" },
    { at: T.helpFly[1] - 0.2, kind: "droneSweat" },
    { at: 5.5, kind: "droneSweat" },
    { at: 6.2, kind: "droneSweat" },
    { at: T.grow[0] + 0.3, kind: "droneSweat" },
    { at: T.grow[1] - 0.15, kind: "burst" },
    { at: T.grow[1] - 0.15, kind: "blip", sound: "star" },
    { at: T.thanks + 0.5, kind: "hearts" },
    { at: 10.7, kind: "bubble", icon: "heart" },
    { at: T.bow[1] + 0.35, kind: "duoReact", react: "cheer" },
    { at: 11.5, kind: "bubble", icon: "sparkle" },
    { at: T.bow[1] + 1.1, kind: "duoReact", react: "shy" },
    { at: T.leave[0] + 0.05, kind: "blip", sound: "whoosh" },
    { at: 12.2, kind: "bubble", icon: "smile" },
    { at: T.leave[1], kind: "blip", sound: "confirm" },
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
