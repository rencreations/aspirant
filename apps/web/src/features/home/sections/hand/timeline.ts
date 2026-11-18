/**
 * The beats of the hand and the list that follows it, as pure functions of the scroll. The two
 * sections are one choreography (the doll lands in the palm, sits there, is tossed onto the first
 * frame of the list, the hand leaves), so both read the same numbers and agree at the joint J7.
 *
 * Time here is in screens. `t` is the position since the start of the hand section (it is negative
 * in the hand's lead and runs on into the list); `s` is the position since the start of the list,
 * so `t = HAND_SCREENS + s`. Stage pixels: origin in the middle of the screen, x right, y up.
 */

/** The lengths the registry uses (design section 4). The integrator may change them. */
export const HAND_SCREENS = 3.4;
export const LIST_SCREENS = 8.6;

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
 * The moments of the hand section, in screens from its start. The palm arrives at 1.0 and the
 * doll lands in it, the words come in while she stands up and sits, the fingers are live from 2.0
 * (three quarters of a screen of rest before the hand begins to come down), and the words are left
 * behind above while the hand goes down.
 */
export const HAND_AT = {
  /** The fingertips show at the bottom edge here (joint J6). */
  tips: 0,
  /** The palm has arrived. */
  arrived: 1.0,
  /** The doll lands in the palm. */
  land: 1.0,
  /** She has stood up, and sat down. */
  stood: 1.45,
  sat: 1.9,
  title: [1.5, 2.1],
  desc: [1.75, 2.3],
  hint: [2.0, 2.4],
  react: [2.0, 2.4],
  /** The hand comes down. */
  drop: [2.75, 3.4],
  /** The words rise away, left behind above, while the hand goes down and the frame arrives. */
  textOut: [2.9, 3.4],
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

/** What the hand section does at `t` screens from its start. Fills `out` and returns it. */
export function handBeats(t: number, out: HandBeats): HandBeats {
  const A = HAND_AT;
  // The fingertips come to the bottom edge in the lead (a rise of 0.13 puts them there), then the
  // palm comes up.
  const tipsRise = 0.13;
  out.rise =
    t < A.tips
      ? tipsRise * smooth(seg(t, -0.5, A.tips))
      : mix(tipsRise, 1, smooth(seg(t, A.tips, A.arrived)));
  out.drop = smooth(seg(t, A.drop[0], A.drop[1]));
  out.fall = easeInQuad(seg(t, A.tips, A.land));
  out.landed = t >= A.land;
  out.stand = smooth(seg(t, A.land + 0.1, A.stood));
  out.sit = smooth(seg(t, A.stood, A.sat));
  out.react = smooth(seg(t, A.react[0], A.react[1]));
  out.title = seg(t, A.title[0], A.title[1]);
  out.desc = seg(t, A.desc[0], A.desc[1]);
  out.hint = seg(t, A.hint[0], A.hint[1]);
  out.textOut = seg(t, A.textOut[0], A.textOut[1]);
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

/** The moments of the list, in screens from its start. */
export const LIST_AT = {
  /** The frame window, its chrome and the title come in (the lead, before the list starts). */
  appear: [-0.3, 0.1],
  /** The doll crouches, is tossed up and lands on the frame. */
  crouch: [-0.08, 0.14],
  toss: [0.14, 0.62],
  settle: 0.82,
  /** The hand leaves. */
  sink: [0.3, 0.95],
  /** The first name, then the strip. */
  nameIn: [0.55, 0.95],
  stripFrom: 1.05,
  /** Screens for one step of the strip. */
  step: 0.62,
  /** The tenth frame (Selena) has arrived and stands still. */
  expandFrom: 7.0,
  expandTo: 8.05,
} as const;

/** The number of frames of the strip: nine pictures and Selena in 3D. */
export const FRAME_COUNT = 10;

/** Where the strip is after the last step. */
export const STRIP_END = LIST_AT.stripFrom + LIST_AT.step * (FRAME_COUNT - 1);

/** The scroll position (screens from the list's start) at which frame `i` stands at rest. */
export function restOf(i: number): number {
  return LIST_AT.stripFrom + LIST_AT.step * Math.min(FRAME_COUNT - 1, Math.max(0, i));
}

const sineInOut = (u: number): number => 0.5 * (1 - Math.cos(Math.PI * u));

/**
 * The strip's index (0 to 9), after oryzo: each step is a tenth of rest, eight tenths of sineInOut
 * motion and a tenth of rest, so there is no snapping and the page keeps scrolling under it.
 */
export function stripIndex(s: number): number {
  const raw = (s - LIST_AT.stripFrom) / LIST_AT.step;
  if (raw <= 0) return 0;
  if (raw >= FRAME_COUNT - 1) return FRAME_COUNT - 1;
  const whole = Math.floor(raw);
  return whole + sineInOut(seg(raw - whole, 0.1, 0.9));
}

export interface ListBeats {
  /** The frame, its chrome and the title arriving (0..1). */
  appear: number;
  index: number;
  /** The doll's toss, 0 (on the palm) to 1 (on the frame), and the crouch before it (0..1). */
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
  /** The same, linear in the scroll. */
  expandRaw: number;
}

export function listBeats(s: number, out: ListBeats): ListBeats {
  const A = LIST_AT;
  out.appear = smooth(seg(s, A.appear[0], A.appear[1]));
  out.index = stripIndex(s);
  out.crouch = smooth(seg(s, A.crouch[0], A.crouch[1]));
  out.toss = seg(s, A.toss[0], A.toss[1]);
  out.settle = smooth(seg(s, A.toss[1], A.settle));
  out.sink = seg(s, A.sink[0], A.sink[1]);
  out.nameIn = smooth(seg(s, A.nameIn[0], A.nameIn[1]));
  out.expandRaw = seg(s, A.expandFrom, A.expandTo);
  out.expand = easeInOutCubic(out.expandRaw);
  return out;
}

export function newListBeats(): ListBeats {
  return {
    appear: 0,
    index: 0,
    crouch: 0,
    toss: 0,
    settle: 0,
    sink: 0,
    nameIn: 0,
    expand: 0,
    expandRaw: 0,
  };
}
