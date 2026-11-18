/**
 * The beats of the Selena section as pure functions of the scroll. `u` is the position in screens
 * since the start of the section (negative in its lead, up to `SELENA_SCREENS` at its end, a little
 * more in its tail). Everything here is a function of `u` and nothing else, so a jump of the scroll
 * gives the picture a slow scroll gives.
 *
 * The story, in screens:
 *
 *   0 to 0.6      the drawer opens on the left; the dragon glides in from the right edge
 *   0.6 to 2.0    rest: Selena and Silverbolt in `city_idle`, fully interactive, the doll hangs
 *                 (the drawer is fully open at local 0.5, which is where a keyboard focus lands)
 *   2.0 to 2.45   the doll lets go of the top edge, falls and floats over Selena's right hand
 *   2.0 to 2.4    the words and the drawer leave
 *   2.25 to 2.65  the camera swings into the baked one, Selena's pose goes from the idle to the clip
 *   2.65 to 3.5   the clip `city_intercation03` plays by the scroll (the doll floats, the dragon
 *                 opens its jaw, eats it, passes the lens)
 *   3.22 to 3.36  the ground flashes white on the bite, before the dragon reaches the lens
 *   3.55 to 3.7   once the dragon has left, a white over the canvas takes Selena too; the actors leave
 *   3.8 and on    white, the first frame of the voices
 */

export const SELENA_SCREENS = 3.8;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
/** 0 before `a`, 1 after `b`, linear between. */
export const seg = (v: number, a: number, b: number): number => clamp01((v - a) / (b - a));
export const smooth = (x: number): number => x * x * (3 - 2 * x);
export const mix = (a: number, b: number, x: number): number => a + (b - a) * x;

/** Where each beat lies, in screens. One place to tune them. */
export const AT = {
  /** The drawer's panel slides in; the words follow inside it. */
  drawer: [0.05, 0.6],
  words: [0.2, 0.8],
  /** The dragon glides in from the right edge. */
  dragon: [0.25, 1.1],
  /** The last screen of the rest. The drawer is open through local 0.5 (u 1.9). */
  restEnd: 2.0,
  wordsOut: [2.0, 2.28],
  drawerOut: [2.05, 2.42],
  /** The camera leaves the pixel view for the baked one. */
  camera: [2.25, 2.65],
  /** Selena's pose goes from the idle to the clip. */
  pose: [2.3, 2.65],
  /** The doll lets go of the top edge, falls and arrives over the hand (before the camera moves). */
  doll: [2.0, 2.45],
  /**
   * The ground goes white behind the dragon: a flash that starts on the bite and is complete before
   * the dragon's head reaches the lens (the clip's 3.7 s), so it passes over a white screen.
   */
  white: [3.22, 3.36],
  /** Then a white over everything takes Selena too, and the actors are gone by the end of it. */
  front: [3.55, 3.7],
  /** The white over the canvas hands over to the one under it (the same colour), at the end. */
  frontOut: [3.8, 3.95],
  /** The white of the layer leaves again in the tail, when the ground behind it is the next one's. */
  whiteOut: [4.05, 4.3],
} as const;

/**
 * Screens to seconds of the clip: the clip starts at the first key and ends at the last. The hover of
 * the doll (1.2 to 2.6 s) plays fastest, the eat (2.95 to 3.5 s) slower and the dragon's pass
 * (3.5 to 3.95 s) slowest (a third of a screen), so the pass is not over before it is seen.
 */
export const FILM_KEYS: ReadonlyArray<readonly [u: number, t: number]> = [
  [2.65, 0],
  [2.8, 1.2],
  [3.0, 2.6],
  [3.08, 2.95],
  [3.22, 3.5],
  [3.55, 3.95],
];

/** The end of the clip we play: the dragon has left the frame at 3.9 s (`BAKED.pass.outAt`). */
export const FILM_END = 3.95;

/** The clip time in seconds for a position, 0 before the first key and `FILM_END` after the last. */
export function filmTime(u: number): number {
  const first = FILM_KEYS[0]!;
  const last = FILM_KEYS[FILM_KEYS.length - 1]!;
  if (u <= first[0]) return 0;
  if (u >= last[0]) return last[1];
  for (let i = 1; i < FILM_KEYS.length; i += 1) {
    const b = FILM_KEYS[i]!;
    if (u > b[0]) continue;
    const a = FILM_KEYS[i - 1]!;
    return mix(a[1], b[1], (u - a[0]) / (b[0] - a[0]));
  }
  return last[1];
}

/** The scroll for a clip time (the inverse of `filmTime`), for the probes and the tests. */
export function screensAtFilm(t: number): number {
  const first = FILM_KEYS[0]!;
  const last = FILM_KEYS[FILM_KEYS.length - 1]!;
  if (t <= first[1]) return first[0];
  if (t >= last[1]) return last[0];
  for (let i = 1; i < FILM_KEYS.length; i += 1) {
    const b = FILM_KEYS[i]!;
    if (t > b[1]) continue;
    const a = FILM_KEYS[i - 1]!;
    return mix(a[0], b[0], (t - a[1]) / (b[1] - a[1]));
  }
  return last[0];
}

/** What happens to the doll in the clip, in seconds of it. */
export const DOLL_T = {
  /** She floats over the hand from here (the recording shows her from 1.6 s). */
  float: 1.2,
  /** She is thrown toward the dragon's mouth from here, and is in it at `bite`. */
  fly: 2.95,
  bite: 3.5,
  /** The jaw opens wide before the bite, and has closed by here. */
  jawOpen: [2.7, 3.05],
  jawShut: [3.5, 3.68],
} as const;

export interface Beats {
  /** The drawer's panel, 0 (away) to 1 (open). */
  drawer: number;
  /** The dragon's glide in, 0 (off the right edge) to 1 (in its place). */
  dragon: number;
  /** The baked camera over the pixel one, 0 to 1. */
  camera: number;
  /** Selena's clip over her idle, 0 to 1. */
  pose: number;
  /** The doll's fall to the hand, 0 (hanging) to 1 (over the hand). */
  doll: number;
  /** Seconds of the clip. */
  t: number;
  /** The white behind the dragon, 0 to 1. */
  white: number;
  /** The white over the canvas, 0 to 1 (and back to 0 as it hands over to the white under it). */
  front: number;
  /** The white layer's own fade out in the tail, 0 (still there) to 1 (gone). */
  whiteOut: number;
  /** The clip is the picture (the baked camera is drawn): true from where the camera has arrived. */
  film: boolean;
  /** The interactive part: the pixel view, the pointer reaches Selena and the dragon. */
  live: boolean;
  /** The actors are drawn at all (false once the stage is white). */
  actors: boolean;
}

export function newBeats(): Beats {
  return {
    drawer: 0,
    dragon: 0,
    camera: 0,
    pose: 0,
    doll: 0,
    t: 0,
    white: 0,
    front: 0,
    whiteOut: 0,
    film: false,
    live: true,
    actors: true,
  };
}

/** All the beats for `u` screens, written into `out`. */
export function beatsAt(u: number, out: Beats = newBeats()): Beats {
  const open = smooth(seg(u, AT.drawer[0], AT.drawer[1]));
  const close = smooth(seg(u, AT.drawerOut[0], AT.drawerOut[1]));
  out.drawer = open * (1 - close);
  out.dragon = smooth(seg(u, AT.dragon[0], AT.dragon[1]));
  out.camera = smooth(seg(u, AT.camera[0], AT.camera[1]));
  out.pose = smooth(seg(u, AT.pose[0], AT.pose[1]));
  out.doll = seg(u, AT.doll[0], AT.doll[1]);
  out.t = filmTime(u);
  out.white = smooth(seg(u, AT.white[0], AT.white[1]));
  out.front =
    smooth(seg(u, AT.front[0], AT.front[1])) * (1 - smooth(seg(u, AT.frontOut[0], AT.frontOut[1])));
  out.whiteOut = smooth(seg(u, AT.whiteOut[0], AT.whiteOut[1]));
  out.film = out.camera >= 1;
  out.live = u < AT.restEnd;
  out.actors = u < AT.front[1];
  return out;
}
