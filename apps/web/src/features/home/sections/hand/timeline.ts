/**
 * The beats of the hand and the list that follows it, as pure functions of three numbers. The two
 * sections are one choreography (the doll lands in the palm, sits there, is tossed onto the first
 * frame of the list, rides the frames, the hand leaves), so both read the same numbers and agree at
 * the joint J7. The scenes are plays (`stations.ts`), so their time is beat time, not scroll:
 *
 *  - `t` is the hand's beat, 0 to `HAND_LAST` (negative in the hand's lead, in screens);
 *  - `u` is the list's beat, 0 to `LIST_LAST` (a few tenths of a screen below 0 in its lead);
 *  - `ts` is the scroll, in screens, past the joint where the hand ends and the list begins: the
 *    short scroll-linked join of the two rests (the hand comes down, the words leave, the frame
 *    arrives) uses it.
 *
 * Stage pixels: origin in the middle of the screen, x right, y up.
 */
import { sectionScreens } from "../../kernel/where";

import { FRAME_COUNT, HAND_LAST, LIST_LAST } from "./stations";

/** The lengths are the registry's (`kernel/where.ts`): change them in the sections' `index.ts`. */
export const handScreens = (): number => sectionScreens("hand");
export const listScreens = (): number => sectionScreens("list");

export interface Vp {
  readonly w: number;
  readonly h: number;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
/** 0 before `a`, 1 after `b`, linear between. */
export const seg = (v: number, a: number, b: number): number => clamp01((v - a) / (b - a));
export const smooth = (u: number): number => u * u * (3 - 2 * u);
const easeInQuad = (u: number): number => u * u;
const easeInOutCubic = (u: number): number => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
export const mix = (a: number, b: number, u: number): number => a + (b - a) * u;

/** A phone held upright (the hand is a little smaller and leans to the left, as its notes say). */
export function isPortrait(vp: Vp): boolean {
  return vp.w < vp.h * 0.75;
}

export interface HandGeometry {
  /** Where the wrist rests, and how tall the hand is on the screen (its claws above the wrist). */
  readonly x: number;
  readonly restY: number;
  readonly height: number;
  readonly scale: number;
  /** The point of the palm the doll stands on, from the wrist at rest (measured in the lab). */
  readonly standDx: number;
  readonly standDy: number;
  /** How far the hand comes down at the end of the hand section. */
  readonly drop: number;
  /** The doll's height on the palm, and in the air at the joint J6. */
  readonly dollHeight: number;
  readonly airX: number;
  readonly airY: number;
  readonly airHeight: number;
}

/**
 * The hand's place. `height` is about 0.55 of the screen (its notes), a phone makes it 0.6 with a
 * scale of 0.85 and a step to the left, so the palm and four fingers show.
 */
export function handGeometry(vp: Vp): HandGeometry {
  const portrait = isPortrait(vp);
  const height = (portrait ? 0.6 : 0.55) * vp.h;
  const scale = portrait ? 0.85 : 1;
  const x = portrait ? -40 : 0;
  const restY = -vp.h / 2;
  // Measured with the lab at 1440 x 900 (palm at +10, -296 from a wrist at 0, -450, height 495) and
  // at 390 x 844 (-29, -286 from -40, -422, height 506, scale 0.85).
  const standDx = 0.021 * height * scale;
  const standDy = 0.311 * height * scale;
  const dollHeight = 0.17 * vp.h;
  return {
    x,
    restY,
    height,
    scale,
    standDx,
    standDy,
    drop: 0.08 * vp.h,
    dollHeight,
    airX: 0,
    airY: 0.1 * vp.h,
    airHeight: 0.26 * vp.h,
  };
}

/**
 * The doll at the end of the fall (joint J6), as the bolt section's journey leaves her: her feet 0.1
 * of the screen above the middle, 0.26 of the screen tall, hips as the pivot, depth 60, the pose 0.7
 * of the way from "fall" to "stand", a little flail. The bolt folder owns the numbers and
 * `timeline.test.ts` keeps these equal to its exports.
 */
export const J6 = {
  feetY: 0.1,
  height: 0.26,
  z: 60,
  standWeight: 0.7,
  flail: 0.2,
  flailRate: 0.6,
} as const;

/** The doll's hips are this share of her height above her feet when she stands (measured). */
export const HIPS_ABOVE_FEET = 0.396 / 1.7;

/** Where the doll's hips are, and how tall she is, at the end of the fall. Stage pixels. */
export function fallEnd(vp: Vp): { x: number; y: number; height: number } {
  const height = J6.height * vp.h;
  return { x: 0, y: (J6.feetY + HIPS_ABOVE_FEET * J6.height) * vp.h, height };
}

/**
 * The moments of the hand section, in its beats. The palm arrives at 0.9 and the doll lands in it,
 * the words come in while she stands up and sits, and the fingers are live from 1.75 until the list's
 * toss begins.
 */
export const HAND_AT = {
  /** The fingertips show at the bottom edge here (joint J6). */
  tips: 0,
  /** The palm has arrived. */
  arrived: 0.9,
  /** The doll lands in the palm. */
  land: 0.9,
  /** She has stood up, and sat down. */
  stood: 1.3,
  sat: 1.7,
  title: [1.3, 1.9],
  desc: [1.5, 2.0],
  hint: [1.7, HAND_LAST],
  react: [1.75, HAND_LAST],
} as const;

/**
 * The join of the hand's rest and the list's toss, in screens past the joint (negative before it):
 * the hand comes down a little, the words are left behind above, the frame arrives behind the hand.
 */
export const JOIN_AT = {
  drop: [-0.4, 0],
  textOut: [-0.4, -0.05],
  appear: [-0.35, 0.05],
} as const;

export interface HandBeats {
  /** `hand.rise`. */
  rise: number;
  /** 0..1 of `HandGeometry.drop`. */
  drop: number;
  /** The doll's fall to the palm, 0 (J6) to 1 (landed). Eased like gravity. */
  fall: number;
  landed: boolean;
  /** The doll stands up after the landing (0..1) and sits (0..1). */
  stand: number;
  sit: number;
  /** How much the pointer moves the fingers. */
  react: number;
  title: number;
  desc: number;
  hint: number;
  /** 0..1 the text leaving. */
  textOut: number;
}

/** What the hand section does at beat `t`, with the join `ts` screens past the hand's end. */
export function handBeats(t: number, ts: number, out: HandBeats): HandBeats {
  const A = HAND_AT;
  // The fingertips come to the bottom edge in the lead (a rise of 0.13 puts them there), then the
  // palm comes up.
  const tipsRise = 0.13;
  out.rise =
    t < A.tips
      ? tipsRise * smooth(seg(t, -0.5, A.tips))
      : mix(tipsRise, 1, smooth(seg(t, A.tips, A.arrived)));
  out.drop = smooth(seg(ts, JOIN_AT.drop[0], JOIN_AT.drop[1]));
  out.fall = easeInQuad(seg(t, A.tips, A.land));
  out.landed = t >= A.land;
  out.stand = smooth(seg(t, A.land + 0.1, A.stood));
  out.sit = smooth(seg(t, A.stood, A.sat));
  out.react = smooth(seg(t, A.react[0], A.react[1]));
  out.title = seg(t, A.title[0], A.title[1]);
  out.desc = seg(t, A.desc[0], A.desc[1]);
  out.hint = seg(t, A.hint[0], A.hint[1]);
  out.textOut = seg(ts, JOIN_AT.textOut[0], JOIN_AT.textOut[1]);
  return out;
}

export function newHandBeats(): HandBeats {
  return {
    rise: 0,
    drop: 0,
    fall: 0,
    landed: false,
    stand: 0,
    sit: 0,
    react: 0,
    title: 0,
    desc: 0,
    hint: 0,
    textOut: 0,
  };
}

// ----------------------------------------------------------------------------------------- list

/** The moments of the list, in its beats `u` (the frame `k` rests at `u = 1 + k`). */
export const LIST_AT = {
  /** She stands up in the palm, crouches, is tossed up and lands on the frame. */
  stand: [0, 0.1],
  crouch: [0.06, 0.2],
  toss: [0.2, 0.62],
  settle: 0.82,
  /** The hand leaves. */
  sink: [0.35, 0.95],
  /** The first name. */
  nameIn: [0.55, 0.95],
  /** The first frame rests here, and the tenth frame has arrived (Selena, in the window). */
  stripFrom: 1,
  /** The tenth frame grows into the whole screen. */
  expandFrom: FRAME_COUNT,
  expandTo: LIST_LAST,
} as const;

/** The strip's index (0 to 9) at beat `u`: frame `k` stands at `u = 1 + k`, and the play moves it. */
export function stripIndex(u: number): number {
  return Math.min(FRAME_COUNT - 1, Math.max(0, u - LIST_AT.stripFrom));
}

export interface ListBeats {
  /** The frame, its chrome and the title arriving (0..1). */
  appear: number;
  index: number;
  /** She stands up (0..1), the crouch before the toss, the toss (0 on the palm, 1 on the frame). */
  stand: number;
  crouch: number;
  toss: number;
  /** She has landed and sits (0..1). */
  settle: number;
  /** `hand.sink`. */
  sink: number;
  /** The first name arriving (0..1). */
  nameIn: number;
  /** The tenth frame growing into the whole screen (0..1, eased). */
  expand: number;
  /** The same, linear in the beat. */
  expandRaw: number;
}

/** What the list does at beat `u`, with the join `ts` screens past the joint. */
export function listBeats(u: number, ts: number, out: ListBeats): ListBeats {
  const A = LIST_AT;
  out.appear = smooth(seg(ts, JOIN_AT.appear[0], JOIN_AT.appear[1]));
  out.index = stripIndex(u);
  out.stand = smooth(seg(u, A.stand[0], A.stand[1]));
  out.crouch = smooth(seg(u, A.crouch[0], A.crouch[1]));
  out.toss = seg(u, A.toss[0], A.toss[1]);
  out.settle = smooth(seg(u, A.toss[1], A.settle));
  out.sink = seg(u, A.sink[0], A.sink[1]);
  out.nameIn = smooth(seg(u, A.nameIn[0], A.nameIn[1]));
  out.expandRaw = seg(u, A.expandFrom, A.expandTo);
  out.expand = easeInOutCubic(out.expandRaw);
  return out;
}

export function newListBeats(): ListBeats {
  return {
    appear: 0,
    index: 0,
    stand: 0,
    crouch: 0,
    toss: 0,
    settle: 0,
    sink: 0,
    nameIn: 0,
    expand: 0,
    expandRaw: 0,
  };
}
