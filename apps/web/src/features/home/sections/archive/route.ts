/**
 * The last stretch of the home's scroll, as pure functions of the position `S` (screens): the
 * drone's journey from Tetra at the lower left (joint J14), over the ten covers of the archive, down
 * to the middle of the footer's card (joint J15) and out to the right, where About's opening picks it
 * up. The archive's runtime and the footer's runtime both read it, each for its own part of the
 * range, so the order they run in cannot matter and a jump anywhere gives the picture of a slow
 * scroll. No three.js, no DOM, nothing allocated per call (every function writes into `out`).
 *
 * Two frames meet here. The route works in the screen frame (pixels, origin at the top left, y down)
 * and hands the result to the actors in the stage frame (origin in the middle, y up): `toStage`.
 *
 * Times, in screens of the home's scroll (the archive starts at 56.1 and the page ends at 60.3):
 *
 *   56.10 to 56.35   Tetra waves goodbye; the drone, beside her, looks at her
 *   56.20 to 56.60   the drone leaves her and flies up over the first cover
 *   56.30 to 56.65   Tetra runs off to the left
 *   56.35 to 56.65   the covers rise in, the left one first
 *   56.55 to 58.10   the tour: the drone rests over each room in turn and the light follows it
 *   58.10 to 58.80   the covers lift away, the light goes out, the footer's card rises
 *   58.10 to 59.10   the drone flies down to the middle of the footer's card (it rises to meet it)
 *   59.10 to 60.00   the card stands; the drone rests in its ring
 *   59.40 to 60.275  the hairline under the words fills (it is full at the point the page opens About)
 *   60.00 to 60.30   the drone leaves to the right, at the height where About's drone comes in
 */
import { SIZE_PER_HEIGHT } from "../../actors/drone/model";
import { REST, REST_DRONE } from "../bend/beats";

import { coverX, tourP, type StripGeo } from "./geometry";

export const AT = {
  /** The archive's own start (joint J14). */
  start: 56.1,
  waveTo: 56.35,
  leave: 56.2,
  arrive: 56.6,
  runFrom: 56.3,
  runTo: 56.65,
  coversIn: 56.35,
  coverStep: 0.05,
  coverLen: 0.3,
  tourFrom: 56.55,
  tourTo: 58.1,
  lightOut: 58.1,
  lightLen: 0.3,
  coversOut: 58.05,
  coverOutStep: 0.02,
  coverOutLen: 0.33,
  /** The footer's card is stuck from here (the start of the footer section: joint J15). */
  stuck: 59.1,
  hairFrom: 59.4,
  hairTo: 60.275,
  exitFrom: 60.0,
  /** The very end of the page. */
  end: 60.3,
  /** The footer's runtime takes the drone from here (its lead begins). */
  handover: 58.6,
} as const;

export interface Vp {
  readonly w: number;
  readonly h: number;
}

/** A place in the screen frame. */
export interface Spot {
  x: number;
  y: number;
  height: number;
}

/** Where the footer's ring is: measured from the page, a default until it has been. */
export interface FootGeo {
  /** Screen x of the middle of the ring. */
  x: number;
  /** Distance from the top of the footer's stage to the middle of the ring. */
  offY: number;
  /** The ring's diameter. */
  size: number;
}

export function defaultFoot(vp: Vp): FootGeo {
  return { x: vp.w / 2, offY: 0.4 * vp.h, size: Math.min(0.26 * vp.h, 0.5 * vp.w) };
}

let measured: FootGeo | null = null;
let fallback: { w: number; h: number; geo: FootGeo } | null = null;

/** The footer's runtime says where its ring is (null when it goes). One module, shared by both runtimes. */
export function setFoot(geo: FootGeo | null): void {
  measured = geo;
}

/** The ring as measured, or a default for the viewport (made once per size, so a frame allocates nothing). */
export function footFor(vp: Vp): FootGeo {
  if (measured) return measured;
  if (fallback?.w !== vp.w || fallback.h !== vp.h) {
    fallback = { w: vp.w, h: vp.h, geo: defaultFoot(vp) };
  }
  return fallback.geo;
}

/** The drone stands this share of the ring's diameter tall. */
export const IN_RING = 0.6;

const smooth = (u: number): number => u * u * (3 - 2 * u);
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const ramp = (v: number, a: number, b: number): number => clamp01((v - a) / (b - a));
const mix = (a: number, b: number, k: number): number => a + (b - a) * k;

/** The stage frame (middle origin, y up) of a point of the screen frame. */
export function toStage(vp: Vp, spot: Spot, out: Spot): Spot {
  out.x = spot.x - vp.w / 2;
  out.y = vp.h / 2 - spot.y;
  out.height = spot.height;
  return out;
}

/** The tour progress `u` (0 to 1) at `S`. */
function tourU(S: number): number {
  return ramp(S, AT.tourFrom, AT.tourTo);
}

/** The tour position (0 to 9) at `S`: the strip's slide and the drone's place follow it. */
export function tourAt(S: number): number {
  return tourP(tourU(S));
}

/** How much the spotlight is on, 0 to 1: it comes on as the drone arrives and goes as the tour ends. */
export function lightAt(S: number): number {
  return (
    ramp(S, AT.arrive - 0.1, AT.arrive + 0.1) *
    (1 - ramp(S, AT.lightOut, AT.lightOut + AT.lightLen))
  );
}

/**
 * How far cover `i` has risen in, 0 to 1. The first four are on the screen and rise one after the
 * other; the rest are off to the right and are in by the time the fourth is.
 */
export function coverIn(S: number, i: number): number {
  const at = AT.coversIn + AT.coverStep * Math.min(i, 3);
  return smooth(ramp(S, at, at + AT.coverLen));
}

/** How far cover `i` has lifted away, 0 to 1. */
export function coverOut(S: number, i: number): number {
  const at = AT.coversOut + AT.coverOutStep * i;
  return smooth(ramp(S, at, at + AT.coverOutLen));
}

/**
 * How far the title and the button of the archive are shown, 0 to 1: they come in as the first cover
 * rises (the section starts with Tetra and the drone alone on the paper) and go with the last covers.
 * `late` delays the button a little behind the title.
 */
export function headAt(S: number, late = 0): number {
  return (
    ramp(S, AT.coversIn + late, AT.coversIn + 0.35 + late) *
    (1 - ramp(S, AT.coversOut + 0.1, AT.coversOut + 0.5))
  );
}

/** The hairline under the footer's words, 0 to 1. */
export function hairAt(S: number): number {
  return ramp(S, AT.hairFrom, AT.hairTo);
}

/** The top of the footer's stage on the screen (px), at the real scroll `raw`: it rises, then sticks at 0. */
export function stageTop(raw: number, vp: Vp): number {
  return Math.max(0, AT.stuck - raw) * vp.h;
}

/**
 * Where About's opening drone comes in (its parked place at the right edge): the height of its
 * pass over the title and its width. Read from the live About page at five sizes (the title's box
 * and `passSize` in `features/about/choreo/intro.ts`): a landscape screen gives about 0.27 of the
 * height for both, a portrait one 0.186 of the height for the line and the smaller of 0.36 of the
 * width and 0.185 of the height for the size. `features/about` is read only, so this is a measured
 * copy; `scripts/qa/probes/home-s7b.cjs` compares the two.
 */
export function aboutEntry(vp: Vp): { y: number; size: number } {
  if (vp.w < vp.h) return { y: 0.186 * vp.h, size: Math.min(0.36 * vp.w, 0.185 * vp.h) };
  return { y: 0.27 * vp.h, size: Math.min(0.27 * vp.h, 0.36 * vp.w) };
}

/** The drone at rest beside Tetra: the end of the bend section (joint J14). */
export function restSpot(vp: Vp, out: Spot): Spot {
  out.x = vp.w / 2 + REST_DRONE.x * vp.w;
  out.y = vp.h / 2 - REST_DRONE.y * vp.h;
  out.height = REST_DRONE.h * vp.h;
  return out;
}

/**
 * The drone at `S`, in the screen frame. `q` is where the light is on the strip (a cover index, a
 * fraction between two): the tour's own position unless the visitor has pulled the drone to a cover.
 * `raw` is the real scroll, for what is glued to the page's flow (the footer's card).
 */
export function droneAt(
  S: number,
  raw: number,
  q: number,
  vp: Vp,
  strip: StripGeo,
  foot: FootGeo,
  out: Spot,
): Spot {
  const pS = tourAt(S);
  if (S < AT.leave) return restSpot(vp, out);

  if (S < AT.arrive) {
    // Up and over to the first cover, in an arc.
    restSpot(vp, out);
    const u = smooth(ramp(S, AT.leave, AT.arrive));
    const x = coverX(strip, 0, 0);
    out.x = mix(out.x, x, u);
    out.y = mix(out.y, strip.droneY, u) - Math.sin(Math.PI * u) * 0.06 * vp.h;
    out.height = mix(out.height, strip.droneH, u);
    return out;
  }

  if (S < AT.tourTo) {
    // Pulled to a cover that is mostly off the screen (a neighbour on a phone), the drone still stays on it.
    out.x = Math.min(0.9 * vp.w, Math.max(0.1 * vp.w, coverX(strip, q, pS)));
    out.y = strip.droneY;
    out.height = strip.droneH;
    return out;
  }

  const slotY = stageTop(raw, vp) + foot.offY;
  const slotH = IN_RING * foot.size;

  if (S < AT.stuck) {
    // Down to the ring of the footer's card, which rises to meet it.
    const u = smooth(ramp(S, AT.tourTo, AT.stuck));
    out.x = mix(coverX(strip, 9, 9), foot.x, u);
    out.y = mix(strip.droneY, slotY, u);
    out.height = mix(strip.droneH, slotH, u);
    return out;
  }

  if (S < AT.exitFrom) {
    out.x = foot.x;
    out.y = slotY;
    out.height = slotH;
    return out;
  }

  // The way out: it gathers speed to the right and a little up, and ends past the edge at the
  // height where About's drone comes in.
  const enter = aboutEntry(vp);
  const u = ramp(S, AT.exitFrom, AT.end);
  const exitH = enter.size / SIZE_PER_HEIGHT;
  const exitX = vp.w + 1.2 * enter.size;
  out.x = mix(foot.x, exitX, u * u);
  out.y = mix(slotY, enter.y, smooth(u)) - Math.sin(Math.PI * u) * 0.05 * vp.h;
  out.height = mix(slotH, exitH, u);
  return out;
}

/** Tetra at `S`, in the screen frame: her feet, her height, how far she has run, and her pose. */
export interface TetraWant {
  visible: boolean;
  /** Feet, screen frame. */
  x: number;
  y: number;
  height: number;
  /** 0 to 1: how far she has run off. */
  run: number;
  /** 0 to 1: how much she waves (before the run). */
  wave: number;
}

export function newTetraWant(): TetraWant {
  return { visible: false, x: 0, y: 0, height: 0, run: 0, wave: 0 };
}

export function tetraAt(S: number, vp: Vp, out: TetraWant): TetraWant {
  out.visible = S < AT.runTo + 0.02;
  const x = vp.w / 2 + REST.tx * vp.w;
  const height = REST.th * vp.h;
  out.run = smooth(ramp(S, AT.runFrom, AT.runTo));
  out.x = mix(x, -0.6 * height, out.run);
  out.y = vp.h / 2 - REST.ty * vp.h;
  out.height = height;
  out.wave =
    ramp(S, AT.start, AT.start + 0.1) * (1 - ramp(S, AT.runFrom - 0.02, AT.runFrom + 0.04));
  return out;
}
