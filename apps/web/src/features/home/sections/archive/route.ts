/**
 * The last stretch of the home's scroll, as pure functions of the position `S` (screens): the
 * drone's journey from Tetra in the center (joint J14), over the ten covers of the archive, down
 * to the middle of the footer's card (joint J15) and out to the right, where About's opening picks it
 * up. The archive's runtime and the footer's runtime both read it, each for its own part of the
 * range, so both sections agree at their boundary. Offsets from the archive's start:
 *
 *   0.00 to 0.10   Tetra and the drone hold their places in the center
 *   0.10 to 0.20   Tetra waves goodbye
 *   0.20 to 0.82   she runs left as the strip moves in from the right
 *   0.20 to 0.82   the drone flies over the first cover
 *   1.10 to 2.30   the tour: the drone rests over each room in turn and the light follows it
 *   2.25 to 2.80   the covers lift away and the light goes out (the way out is 1.5 screens: 25 Nov 2026)
 *   2.80 to 3.80   the footer's card rises; the drone flies down to the middle of it (it rises to meet it)
 *   footer 0 to 0.9   the card stands; the drone rests in its ring
 *   footer 0.3 to the end   the hairline under the words fills (full at the point the page opens About)
 *   footer 0.9 to the end   the drone leaves to the right, at the height where About's drone comes in
 */
import { SIZE_PER_HEIGHT } from "../../actors/drone/model";
import { sectionEnd, sectionFrom, sectionScreens, sectionStart } from "../../kernel/where";
import { spotsOf } from "../bend/beats";

import { coverX, tourP, type StripGeo } from "./geometry";
import { ENTRY_AT, ENTRY_SCREENS, EXIT_SCREENS } from "./plays";

const fromArchive = (offset: number): number => sectionStart("archive") + offset;
const fromFooter = (offset: number): number => sectionStart("footer") + offset;

/**
 * The entry's beats were first written for 0.4 screen of route. They keep their shape over the
 * entry's real length: `entryAt(u)` is the place at the fraction `u` of the entry.
 */
const entryAt = (u: number): number => fromArchive(ENTRY_AT + u * ENTRY_SCREENS);
/** The scale from the first 0.4-screen entry to the real one, for the lengths that stay in screens. */
const STRETCH = ENTRY_SCREENS / 0.4;

export const AT = {
  /** The archive's own start (joint J14). */
  get start(): number {
    return fromArchive(0);
  },
  /** The entry begins here: Tetra starts to wave. */
  get entry(): number {
    return entryAt(0);
  },
  get waveTo(): number {
    return entryAt(0.1);
  },
  get leave(): number {
    return entryAt(0.175);
  },
  get arrive(): number {
    return entryAt(0.75);
  },
  get runFrom(): number {
    return entryAt(0.25);
  },
  get runTo(): number {
    return entryAt(0.93);
  },
  get coversIn(): number {
    return AT.runFrom;
  },
  coverStep: 0.03 * STRETCH,
  coverLen: 0.17 * STRETCH,
  /** The entry's end: the tour goes on from here. */
  get tourFrom(): number {
    return entryAt(1);
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
  /** The footer's card starts to rise from the bottom of the screen: one screen before it is stuck. */
  get cardFrom(): number {
    return fromFooter(0) - 1;
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

/** The button of the archive comes in this far behind its title, in screens. */
export const BUTTON_LATE = 0.06 * STRETCH;

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
    ramp(S, AT.arrive - 0.1 * STRETCH, AT.arrive + 0.1 * STRETCH) *
    (1 - ramp(S, AT.lightOut, AT.lightOut + AT.lightLen))
  );
}

/** Tetra and the strip travel the same distance over the same scroll interval. */
export function entryRun(S: number): number {
  return smooth(ramp(S, AT.runFrom, AT.runTo));
}
export function runDistance(vp: Vp): number {
  return vp.w / 2 + 0.62 * spotsOf(vp).rest.th * vp.h;
}

/** All the covers enter together from outside the right edge. */
export function coverIn(S: number, _i: number): number {
  return S >= AT.runFrom ? 1 : 0;
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
    ramp(S, AT.coversIn + late, AT.coversIn + 0.2 * STRETCH + late) *
    (1 - ramp(S, AT.coversOut + 0.1, AT.coversOut + 0.5))
  );
}

/** The hairline under the footer's words, 0 to 1. */
export function hairAt(S: number): number {
  return ramp(S, AT.hairFrom, AT.hairTo);
}

/** The top of the footer's stage on the screen (px), at the scene `raw` (the kernel puts the card there): it rises, then sticks at 0. */
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
 * `raw` is the scene's position, for what is glued to the footer's card (the kernel moves the card to it).
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

  if (S < AT.cardFrom) {
    // The tour, then the way out: the covers lift away under it and it waits where the tour left it
    // until the footer's card rises. Pulled to a cover that is mostly off the screen (a neighbour on a
    // phone), the drone still stays on it.
    out.x = Math.min(0.9 * vp.w, Math.max(0.1 * vp.w, coverX(strip, q, pS)));
    out.y = strip.droneY;
    out.height = strip.droneH;
    return out;
  }

  const slotY = stageTop(raw, vp) + foot.offY;
  const slotH = IN_RING * foot.size;

  if (S < AT.stuck) {
    // Down to the ring of the footer's card, which rises to meet it.
    const u = smooth(ramp(S, AT.cardFrom, AT.stuck));
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
  out.run = entryRun(S);
  out.x = x - runDistance(vp) * out.run;
  out.y = vp.h / 2 - rest.ty * vp.h;
  out.height = height;
  out.wave = ramp(S, AT.entry, AT.waveTo) * (1 - ramp(S, AT.runFrom - 0.03 * STRETCH, AT.runFrom));
  return out;
}
