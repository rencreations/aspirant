/**
 * The beats of the bend section, as numbers. The section is a row of scroll zones (`plays.ts`): the
 * scroll scrubs this clock through a zone and the page snaps to a rest at either end when the
 * visitor stops. This file says what happens at each moment of the clock and is the one place the
 * times are written. Pure: no three.js, no DOM, no allocation per call (`beatAt` writes into the
 * object it is given). The runtime reads it every frame, and the tests hold it (every beat in
 * order, the joints at both ends, a jump anywhere).
 *
 * Times are in beats, the virtual clock of the section (`s = local * BEAT_SPAN`, `local` being the
 * zones' value). One beat is about a screen of scroll. Places are fractions of the viewport: x of the
 * width, y and heights of the height, the origin in the middle, y up (the stage frame of the actors).
 *
 * Every stance has a rest of its own, `REST_BEFORE_EDGE` before the next stance begins: the
 * stance is formed and every picture of its wave has landed.
 *
 *   0.00 to 0.60   Tetra closes the book, puts it away and stands (she moves from the chase's frame to the stage)
 *   0.58           REST: the book is shut, she stands in the middle
 *   0.60 to 4.20   she bends earth, air, water and fire, 0.9 beat each; the fan pictures fly in from the edges, wave by wave
 *   1.42 2.32 3.22 4.12   REST: each stance formed
 *   4.20 to 4.70   she stands down, the wall settles, "Fan art" and "See all fanart" come in
 *   4.70           REST: the wall of fan pictures stands (the garuda hero)
 *   4.70 to 6.00   the pictures gather into a ring around her, the ring turns
 *   6.00 to 6.60   the ring is thrown off the screen
 *   6.10 to 7.25   the splash arts fly in and take a spiral round her
 *   7.30           REST: "Artwork", "See all artwork"
 *   7.30 to 8.15   the spiral turns to the last picture, the drone's
 *   8.15 to 8.40   the drone's picture glides to the right of her, the rest streams off
 *   8.42 to 8.65   the drone comes out of the paper
 *   8.60 to 9.45   the drone meets Tetra: it flies to her, pats her head, they hug, and they go to the lower left
 *   9.45           REST: the end (the archive starts from it)
 */

type TetraPoseName = "read" | "close" | "stand" | "idle" | "bend" | "pat" | "hug" | "run";
type BendName = "earth" | "air" | "water" | "fire";

/** The times, in beats from the start of the section. */
export const T = {
  /** The book shuts, she puts it away, she stands. */
  closeFrom: 0.05,
  standAt: 0.4,
  /** She moves from the place the chase left her in to the stage. */
  moveFrom: 0.05,
  moveTo: 0.5,
  /**
   * The four stances, one wave of pictures each. A wave is long enough for its last picture to land
   * (the longest wave staggers 0.28 beat, a flight is `FLIGHT` 0.5) before the stance's rest.
   */
  bendFrom: 0.6,
  wave: 0.9,
  /** The wall stands (the rest, `holdTo`) and is touched. */
  holdFrom: 4.21,
  holdTo: 4.7,
  /** Into the ring. */
  gatherFrom: 4.7,
  gatherTo: 5.6,
  ringTo: 6.0,
  /** Out of the ring. */
  outFrom: 6.0,
  outTo: 6.6,
  /** The spiral, and the rest that shows it (`restArt`). */
  spiralFrom: 6.1,
  spiralTo: 7.25,
  restArt: 7.3,
  advFrom: 7.3,
  advTo: 8.15,
  /** The drone's picture leaves the spiral for its place beside her. */
  glideFrom: 8.15,
  glideTo: 8.4,
  /** The drone comes out of the paper. */
  popFrom: 8.42,
  popTo: 8.65,
  /** The drone and Tetra. */
  meetFrom: 8.6,
  flyTo: 8.8,
  patTo: 9.0,
  hugTo: 9.2,
  goTo: 9.45,
  /** The words. */
  fanTitleIn: 4.15,
  fanTitleOut: 4.75,
  artTitleIn: 6.9,
  artTitleOut: 7.55,
} as const;

/**
 * How far before the edge of a stance (or of a scene) its rest stands. It is past the dip to the
 * stand (`DIP`), so the rest shows the stance worn in full.
 */
export const REST_BEFORE_EDGE = 0.08;

/** The length of the section's own clock, in beats: `local` 1 is the end (the drone and Tetra at rest). */
export const BEAT_SPAN = T.goTo;

/** The stances in the order of the waves, and the side each is aimed at. */
export const STANCES: ReadonlyArray<{ kind: BendName; aim: number }> = [
  { kind: "earth", aim: -1 },
  { kind: "air", aim: 1 },
  { kind: "water", aim: -1 },
  { kind: "fire", aim: 1 },
];

/** The number of splash cards in the spiral and the last one, the drone's. */
export const SPIRAL_CARDS = 11;
export const DRONE_CARD = SPIRAL_CARDS - 1;

/** Where Tetra is, as fractions of the viewport. `ty` is her feet, `th` her height. */
interface Spot {
  tx: number;
  ty: number;
  th: number;
}

/**
 * Where the chase leaves her (joint J13): sitting with the comic, centred, the camera close. These
 * are the chase section's own numbers (`zoomFeet` and `zoomH` of `chase/timeline.ts`, a test holds
 * them equal), for a wide screen and for a compact one (the chase's rule, `isCompact`).
 */
export const FROM_CHASE: Spot = { tx: 0, ty: -0.376, th: 0.85 };
const FROM_CHASE_COMPACT: Spot = { tx: 0, ty: -0.3, th: 0.6 };
/** Where she stands to bend: in the middle, the lower half of the screen kept for her feet. */
export const STAGE: Spot = { tx: 0, ty: -0.3, th: 0.46 };
/** Where she and the drone rest at the end (joint J14): the lower left. */
export const REST: Spot = { tx: -0.34, ty: -0.4, th: 0.3 };
/** The drone's rest, beside her, as fractions of the viewport (and its height). */
const REST_DRONE = { x: -0.21, y: -0.3, h: 0.13 };
/** The same on a phone: narrower, so she stands a little in from the edge and the drone is on her right. */
const REST_COMPACT: Spot = { tx: -0.22, ty: -0.4, th: 0.26 };
const REST_DRONE_COMPACT = { x: 0.1, y: -0.32, h: 0.1 };

/** The chase's rule for a compact screen (a phone, a narrow window). */
export function isCompact(w: number, h: number): boolean {
  return w < 760 || w < h * 0.8;
}

interface Spots {
  from: Spot;
  rest: Spot;
  restDrone: { x: number; y: number; h: number };
}

const WIDE_SPOTS: Spots = { from: FROM_CHASE, rest: REST, restDrone: REST_DRONE };
const COMPACT_SPOTS: Spots = {
  from: FROM_CHASE_COMPACT,
  rest: REST_COMPACT,
  restDrone: REST_DRONE_COMPACT,
};

/** The three places that depend on the shape of the screen. */
export function spotsOf(vp: { readonly w: number; readonly h: number }): Spots {
  return isCompact(vp.w, vp.h) ? COMPACT_SPOTS : WIDE_SPOTS;
}

const DEFAULT_VP = { w: 1440, h: 900 } as const;

export interface BeatState {
  /** Screens from the start of the section, unclamped. */
  s: number;
  pose: TetraPoseName;
  /** How strongly the pose is worn. */
  blend: number;
  bend: BendName;
  aim: number;
  /** The wave of the stances that is running (0 to 3), or -1 outside them. */
  wave: number;
  spot: Spot;
  /** The way she faces while she runs to the rest (-1 left). */
  face: number;
  /** 0 to 1: the pat is on (head leaned in). */
  pat: number;
  /** 0 to 1: the hug is on. */
  hug: number;
  /** 0 to 1: she runs to the rest. */
  go: number;
  /** The advance of the spiral: the card that is at the front. 0 to `DRONE_CARD`. */
  adv: number;
  /** 0 to 1: the drone's picture glides to its stage. */
  glide: number;
  /** 0 to 1: the drone comes out of the paper. */
  pop: number;
  /** 0 to 1: the drone's flight to her, then to the rest (see `meetAt`). */
  meet: number;
  fanTitle: number;
  artTitle: number;
}

export function newBeat(): BeatState {
  return {
    s: 0,
    pose: "read",
    blend: 1,
    bend: "earth",
    aim: -1,
    wave: -1,
    spot: { tx: 0, ty: 0, th: 0 },
    face: 1,
    pat: 0,
    hug: 0,
    go: 0,
    adv: 0,
    glide: 0,
    pop: 0,
    meet: 0,
    fanTitle: 0,
    artTitle: 0,
  };
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** 0 before `a`, 1 after `b`, a straight run between. */
export const ramp = (v: number, a: number, b: number): number => clamp01((v - a) / (b - a));
/** The smoothest step (zero slope at both ends). */
export const smoother = (u: number): number => {
  const k = clamp01(u);
  return k * k * k * (k * (k * 6 - 15) + 10);
};
function copySpot(a: Spot, out: Spot): void {
  out.tx = a.tx;
  out.ty = a.ty;
  out.th = a.th;
}

function mixSpot(a: Spot, b: Spot, k: number, out: Spot): void {
  out.tx = a.tx + (b.tx - a.tx) * k;
  out.ty = a.ty + (b.ty - a.ty) * k;
  out.th = a.th + (b.th - a.th) * k;
}

/** A rest keeps the standing pose this long (beats) past its exact value, so float error never tips it into the next scene. */
const REST_GRACE = 0.03;

/** How long a change from one stance to the next takes, in screens: the stance dips to the stand and returns. */
const DIP = 0.07;

/** The screens at which one stance gives way to the next. */
const EDGES: readonly number[] = [
  T.bendFrom + T.wave,
  T.bendFrom + 2 * T.wave,
  T.bendFrom + 3 * T.wave,
  T.gatherTo,
  T.ringTo,
  T.outTo,
  T.spiralTo,
];

/** 1 at a change of stance, falling to 0 a `DIP` away on either side. */
function dipAt(s: number): number {
  let d = 0;
  for (const edge of EDGES) d = Math.max(d, 1 - Math.abs(s - edge) / DIP);
  return clamp01(d);
}

/** The state of the section at `local` (0 to 1, a little outside it in the lead and tail). Writes into `out`. */
export function beatAt(
  local: number,
  out: BeatState,
  vp: { readonly w: number; readonly h: number } = DEFAULT_VP,
): BeatState {
  const s = local * BEAT_SPAN;
  const spots = spotsOf(vp);
  out.s = s;

  // ---- Tetra's pose.
  out.wave = -1;
  out.blend = 1;
  out.bend = "earth";
  out.aim = -1;
  out.pat = 0;
  out.hug = 0;
  out.go = 0;
  out.face = 1;
  if (s < T.closeFrom) {
    out.pose = "read";
  } else if (s < T.standAt) {
    out.pose = "close";
  } else if (s < T.bendFrom) {
    out.pose = "stand";
  } else if (s < T.holdFrom) {
    // The four stances. Each ends with a dip to the stand, so the change of stance is a breath, not a pop.
    out.pose = "bend";
    const w = Math.min(3, Math.floor((s - T.bendFrom) / T.wave));
    const stance = STANCES[w] ?? STANCES[0]!;
    out.wave = w;
    out.bend = stance.kind;
    out.aim = stance.aim;
    out.blend = 1 - 0.85 * dipAt(s);
  } else if (s < T.gatherFrom + REST_GRACE) {
    // The first rest: she stands, no stance and no marks, so the frame the visitor stands in is calm.
    out.pose = "idle";
  } else if (s < T.ringTo) {
    // Gathering the pictures into a ring: the flowing stance, then the sweeping one.
    out.pose = "bend";
    const second = s >= T.gatherTo;
    out.bend = second ? "air" : "water";
    out.aim = second ? 1 : -1;
    out.blend = 1 - 0.85 * dipAt(s);
  } else if (s < T.spiralTo) {
    out.pose = "bend";
    const earth = s >= T.outTo;
    out.bend = earth ? "earth" : "fire";
    out.aim = earth ? -1 : 1;
    out.blend = 1 - 0.85 * dipAt(s);
  } else if (s < T.restArt + REST_GRACE) {
    // The second rest: the same.
    out.pose = "idle";
  } else if (s < T.glideFrom) {
    out.pose = "bend";
    out.bend = "air";
    out.aim = 1;
    out.blend = 1 - 0.85 * dipAt(s);
  } else if (s < T.meetFrom) {
    out.pose = "idle";
  } else if (s < T.flyTo) {
    out.pose = "idle";
  } else if (s < T.patTo) {
    out.pose = "pat";
    out.pat = 1;
  } else if (s < T.hugTo) {
    out.pose = "hug";
    out.hug = 1;
  } else {
    out.pose = s < T.goTo ? "run" : "idle";
    out.go = ramp(s, T.hugTo, T.goTo);
    out.face = -1;
  }

  // ---- Where she stands.
  const arrive = smoother(ramp(s, T.moveFrom, T.moveTo));
  mixSpot(spots.from, STAGE, arrive, out.spot);
  if (s > T.hugTo - 0.02) {
    const g = smoother(ramp(s, T.hugTo, T.goTo));
    mixSpot(STAGE, spots.rest, g, out.spot);
  }
  if (s < 0) copySpot(spots.from, out.spot);

  // ---- The pictures.
  const adv = smoother(ramp(s, T.advFrom, T.advTo));
  out.adv = adv * DRONE_CARD;
  out.glide = smoother(ramp(s, T.glideFrom, T.glideTo));
  out.pop = ramp(s, T.popFrom, T.popTo);
  out.meet = ramp(s, T.meetFrom, T.goTo);

  // ---- The words.
  out.fanTitle =
    ramp(s, T.fanTitleIn, T.fanTitleIn + 0.3) * (1 - ramp(s, T.fanTitleOut, T.fanTitleOut + 0.3));
  out.artTitle =
    ramp(s, T.artTitleIn, T.artTitleIn + 0.3) * (1 - ramp(s, T.artTitleOut, T.artTitleOut + 0.3));
  return out;
}

/**
 * The splash cards are in use (loaded onto the GPU) from the moment the section is built, two screens
 * before it, to its end. Early on purpose: the chase's quiet beat (Tetra sits and reads) draws no card,
 * the uploads are spread over about a second and a half (`cards.ts`, one every third frame) and are
 * done long before the wall, the heaviest frames, stands. The peak is the same as when they were asked
 * for later: the fan pictures are held to 6.15 screens anyway.
 */
export function artNeeded(s: number): boolean {
  return s > -3;
}

/** The fan cards are in use from before the first wave to the end of the ring's exit. */
export function fanNeeded(s: number): boolean {
  return s < T.outTo + 0.5;
}

/** Where a pose pops: a wave's first picture comes in at the start of its stance. Exposed for the marks. */
export function waveStart(w: number): number {
  return T.bendFrom + w * T.wave;
}

/** The wave of the stances that a time falls in (0 to 3), or -1. */
export function waveAt(s: number): number {
  if (s < T.bendFrom || s >= T.bendFrom + 4 * T.wave) return -1;
  return Math.floor((s - T.bendFrom) / T.wave);
}
