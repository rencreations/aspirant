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
 * Times, in screens of the route's clock `S`. They are read from the registry (`kernel/where.ts`), so
 * they move with the sections: each is an offset from the archive's start, the footer's start or
 * the end of the page. The first 0.4 screen of the clock is the entry, a triggered scene (`plays.ts`):
 * the archive's runtime gives the route `routeS(local, S)`, which runs through it on the play's
 * clock and then goes on with the scroll, so everything after the entry is the scroll's own and
 * the footer's card (the page's flow) stays glued to the real scroll. Offsets from the archive's start:
 *
 *   0.00 to 0.10   Tetra waves goodbye; the drone, beside her, looks at her
 *   0.07 to 0.30   the drone leaves her and flies up over the first cover
 *   0.10 to 0.29   Tetra runs off to the left (the first cover rises where she stood: she is out first)
 *   0.14 to 0.40   the covers rise in, the left one first; the title and the button
 *   0.40 to 1.60   the tour: the drone rests over each room in turn and the light follows it
 *   1.55 to 2.30   the covers lift away, the light goes out, the footer's card rises
 *   1.60 to 2.30   the drone flies down to the middle of the footer's card (it rises to meet it)
 *   footer 0 to 0.9   the card stands; the drone rests in its ring
 *   footer 0.3 to the end   the hairline under the words fills (full at the point the page opens About)
 *   footer 0.9 to the end   the drone leaves to the right, at the height where About's drone comes in
 */
import { SIZE_PER_HEIGHT } from "../../actors/drone/model";
import { sectionEnd, sectionFrom, sectionScreens, sectionStart } from "../../kernel/where";
import { spotsOf } from "../bend/beats";

import { coverX, tourP, type StripGeo } from "./geometry";
import { ENTRY_SCREENS, EXIT_SCREENS } from "./plays";

const fromArchive = (offset: number): number => sectionStart("archive") + offset;
const fromFooter = (offset: number): number => sectionStart("footer") + offset;

export const AT = {
  /** The archive's own start (joint J14). */
  get start(): number {
    return fromArchive(0);
  },
  get waveTo(): number {
    return fromArchive(0.04);
  },
  get leave(): number {
    return fromArchive(0.07);
  },
  get arrive(): number {
    return fromArchive(0.3);
  },
  get runFrom(): number {
    return fromArchive(0.1);
  },
  get runTo(): number {
    return fromArchive(0.29);
  },
  get coversIn(): number {
    return fromArchive(0.14);
  },
  coverStep: 0.03,
  coverLen: 0.17,
  /** The entry's end, and the scroll position that fires it: the tour goes on from here. */
  get tourFrom(): number {
    return fromArchive(ENTRY_SCREENS);
  },
  get tourTo(): number {
    return fromArchive(sectionScreens("archive") - EXIT_SCREENS);
  },
  get lightOut(): number {
    return fromArchive(sectionScreens("archive") - EXIT_SCREENS);
  },
  lightLen: 0.3,
  get coversOut(): number {
    return fromArchive(sectionScreens("archive") - EXIT_SCREENS - 0.05);
  },
  coverOutStep: 0.02,
  coverOutLen: 0.33,
  /** The footer's card is stuck from here (the start of the footer section: joint J15). */
  get stuck(): number {
    return fromFooter(0);
  },
  get hairFrom(): number {
    return fromFooter(0.3);
  },
  get hairTo(): number {
    return sectionEnd("footer") - 0.025;
  },
  get exitFrom(): number {
    return fromFooter(0.9);
  },
  /** The very end of the page. */
  get end(): number {
    return sectionEnd("footer");
  },
  /** The footer's runtime takes the drone from here (its lead begins). */
  get handover(): number {
    return sectionFrom("footer");
  },
} as const;

/**
 * The route's clock for the archive's section value `local` (the plays' value) and the scene's
 * scroll `S` (screens). Before the entry fires `local` is 0 and the clock rests at the start;
 * while it runs `local` moves and the scroll is held; after it the clock goes on with the scroll.
 * Continuous at the threshold in both directions, so the entry plays and plays back with no step.
 */
export function routeS(local: number, S: number): number {
  const length = sectionScreens("archive");
  const done = ENTRY_SCREENS / length;
  return AT.start + Math.min(local, done) * length + Math.max(0, S - AT.tourFrom);
}

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
    ramp(S, AT.coversIn + late, AT.coversIn + 0.2 + late) *
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
  // The bend section's own rest for this shape of screen (a phone has its own), so J14 has no jump.
  const rest = spotsOf(vp).restDrone;
  out.x = vp.w / 2 + rest.x * vp.w;
  out.y = vp.h / 2 - rest.y * vp.h;
  out.height = rest.h * vp.h;
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
  const rest = spotsOf(vp).rest;
  const x = vp.w / 2 + rest.tx * vp.w;
  const height = rest.th * vp.h;
  out.run = smooth(ramp(S, AT.runFrom, AT.runTo));
  out.x = mix(x, -0.6 * height, out.run);
  out.y = vp.h / 2 - rest.ty * vp.h;
  out.height = height;
  out.wave = ramp(S, AT.start, AT.start + 0.04) * (1 - ramp(S, AT.runFrom - 0.03, AT.runFrom));
  return out;
}
