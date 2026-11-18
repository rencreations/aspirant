/**
 * The hero and the aspirants are one scene (the logo goes to the bar, the cards gather, spiral and
 * land as the wall, the wall slides, then it opens into the full screen rows). Both sections run in
 * the overlap of the hero's tail and the aspirants' lead, and the field, the logo and the drone are
 * shared, so everything here is a pure function of one number: the absolute scroll `S` in screens.
 * Each runtime turns its own `local` into `S` and asks this file, so the order the kernel runs two
 * sections in never decides the picture (design section 4.1).
 *
 *   S 0 to 0.17    the freeze: the cards float around the logo
 *   S 0.2 to 1.4   the cards highest on the screen leave first and spiral into the ring (premotio)
 *   S 0.4 to 1.3   the logo morphs into the bar with a travelling wave, and is there before the
 *                  ring stands (story p 0.34 is S 1.43)
 *   S 1.43 to 1.76 the ring stands and turns
 *   S 1.76 to 3.95 the cards leave the ring one by one and land as the wall
 *   S 3.3 to 3.95  the picture is clipped to the wall's frame (the left 58 percent)
 *   S 3.9 to 4.5   the words on the right arrive, line by line
 *   S 3.95 to 4.3  the wall begins to slide by itself
 *   S 5.02 to 5.2  the words fold away (the middle of the section, S 5.0, is the resting state: a
 *                  control focused by the keyboard moves the page there, and finds the words shown)
 *   S 5.05 to 5.3  the clip opens, the wall becomes the full screen rows, the slide stops (J2)
 */

export const HERO_SCREENS = 4.2;
export const ASPIRANTS_START = 4.2;
export const ASPIRANTS_SCREENS = 1.6;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** 0 before `a`, 1 after `b`, linear between. */
export function ramp(x: number, a: number, b: number): number {
  return clamp01((x - a) / (b - a));
}

/** Hermite smoothstep over `a` to `b`. */
export function smooth(x: number, a: number, b: number): number {
  const t = ramp(x, a, b);
  return t * t * (3 - 2 * t);
}

/** The scroll position of the hero's `local` (0 to 1 over its own length). */
export const heroS = (local: number): number => local * HERO_SCREENS;

/** The scroll position of the aspirants' `local`. */
export const aspirantsS = (local: number): number => ASPIRANTS_START + local * ASPIRANTS_SCREENS;

export const TIMES = {
  /** The logo's morph progress runs over these screens (a little under one screen, as the reel's). */
  logo: [0.4, 1.3] as const,
  /** The cue ("Scroll to explore") goes out first. */
  cue: [0.05, 0.35] as const,
  /** The clip closes from the whole screen to the wall's frame. */
  clipClose: [3.3, 3.95] as const,
  /** From here a card may be pressed: the cards have landed (story p 0.94). */
  viewable: 3.95,
  /** The words arrive: the first line starts, the last one ends, the stagger between lines. */
  textIn: [3.9, 4.5] as const,
  /** The auto glide of the wall: it starts when the cards have landed. */
  slideIn: [3.95, 4.3] as const,
  /** The words fold away, the glide eases to a stop, the wall opens into the rows. */
  textOut: [5.02, 5.2] as const,
  slideOut: [5.0, 5.27] as const,
  open: [5.08, 5.3] as const,
  /** The clip opens again with the wall (a little ahead of it, so no card is cut while it opens). */
  clipOpen: [5.05, 5.3] as const,
} as const;

/** How fast the wall slides by itself (px per second of the wall's plane). */
export const SLIDE_RATE = 80;

/** The hero's story progress `p` (premotio's own 3 units are 4.2 screens, so it is the scroll). */
export function storyP(S: number): number {
  return clamp01(S / HERO_SCREENS);
}

/** The logo's morph progress `P`, 0 at the rest place, 1 in the bar. Linear in the scroll, so it reverses. */
export function logoP(S: number): number {
  return ramp(S, TIMES.logo[0], TIMES.logo[1]);
}

/** 1 while the cue shows, 0 once the visitor has begun. */
export function cueOpacity(S: number): number {
  return 1 - smooth(S, TIMES.cue[0], TIMES.cue[1]);
}

/**
 * How open the clip is: 1 is the whole screen, 0 is the wall's frame. The cards fly across the
 * screen while they land, the wall then stands in its frame under the words, and the frame opens
 * again with the rows.
 */
export function clipOpen(S: number): number {
  if (S < TIMES.clipOpen[0]) return 1 - smooth(S, TIMES.clipClose[0], TIMES.clipClose[1]);
  return smooth(S, TIMES.clipOpen[0], TIMES.clipOpen[1]);
}

/** 0 for the wall in its frame, 1 for the rows over the whole screen. */
export function rowsBlend(S: number): number {
  return smooth(S, TIMES.open[0], TIMES.open[1]);
}

/** The glide of the wall, px per second: in once the cards have landed, out as the rows open. */
export function slideRate(S: number): number {
  return (
    SLIDE_RATE *
    smooth(S, TIMES.slideIn[0], TIMES.slideIn[1]) *
    (1 - smooth(S, TIMES.slideOut[0], TIMES.slideOut[1]))
  );
}

/** The cards can be pressed (a preview opens) from the landing until the rows have opened. */
export function viewable(S: number): boolean {
  return S >= TIMES.viewable && S < TIMES.open[1] - 0.05;
}

/** The gap between two lines of the words, in screens. */
const LINE_GAP = 0.09;

/** Line `k` of the words, in (0 hidden, 1 shown): the lines arrive one after another. */
export function lineIn(S: number, k: number): number {
  const from = TIMES.textIn[0] + k * LINE_GAP;
  const to = Math.min(TIMES.textIn[1], from + (TIMES.textIn[1] - TIMES.textIn[0] - 3 * LINE_GAP));
  return smooth(S, from, Math.max(to, from + 0.2));
}

/** Line `k` folds away, the first line first (0 shown, 1 gone). */
export function lineOut(S: number, k: number): number {
  const from = TIMES.textOut[0] + k * 0.03;
  return smooth(S, from, Math.min(TIMES.textOut[1], from + 0.12));
}
