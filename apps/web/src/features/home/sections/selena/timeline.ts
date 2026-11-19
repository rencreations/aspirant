/**
 * The beats of the Selena section as pure functions of the story clock. `u` is the story's own
 * time in seconds (`stations.ts`: one unit is one second of a play), negative in the lead, `STORY`
 * at the end. Everything here is a function of `u` and nothing else, so a jump of the scroll gives
 * the picture a played scene gives.
 *
 * The story, in seconds:
 *
 *   0 to 1.0      play one: the drawer opens on the left, its words come, the dragon glides in
 *   1.0           the rest: Selena and Silverbolt in `city_idle`, fully interactive, the doll hangs
 *   1.0 to 1.45   the doll lets go of the top edge, falls and floats over Selena's right hand
 *   1.0 to 1.3    the words and the drawer leave
 *   1.0 to 1.35   Selena rises from the idle to the clip's first pose, while the camera is still out
 *   1.1 to 1.5    the camera swings into the baked one: it holds back, then punches in
 *   1.5 to 3.45   the clip `city_intercation03` (the doll floats, the dragon opens its jaw, eats it,
 *                 passes the lens), faster over the hover and slower over the pass
 *   2.95 to 3.2   the ground flashes white on the bite, before the dragon reaches the lens
 *   3.5 to 3.7    once the dragon has left, a white over the canvas takes Selena too; the actors leave
 *   3.95          white, the first frame of the voices
 */

import { sectionScreens } from "../../kernel/where";

import { REST_U, STORY } from "./stations";

/** The section's length is the registry's (`kernel/where.ts`): change it in `index.ts`. */
export const selenaScreens = (): number => sectionScreens("selena");

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
/** 0 before `a`, 1 after `b`, linear between. */
export const seg = (v: number, a: number, b: number): number => clamp01((v - a) / (b - a));
export const smooth = (x: number): number => x * x * (3 - 2 * x);
export const mix = (a: number, b: number, x: number): number => a + (b - a) * x;

/** Where each beat lies, in seconds of the story. One place to tune them. */
export const AT = {
  /** The drawer's panel slides in; the words follow inside it, one after another. */
  drawer: [0, 0.7],
  /** The first word starts here; each next one 0.1 s later, each takes `WORD_IN`. */
  words: [0.15, 0.5],
  /** The dragon glides in from the right edge. */
  dragon: [0, 0.95],
  /** The room rests from here (the drawer is open) until the film's play starts at `restEnd`. */
  restEnd: REST_U,
  wordsOut: [REST_U, REST_U + 0.2],
  drawerOut: [REST_U, REST_U + 0.3],
  /** The camera leaves the pixel view for the baked one: a quick whip, the middle of it is a few frames. */
  camera: [REST_U + 0.1, REST_U + 0.5],
  /**
   * Selena goes from the idle to the clip's first pose. It is done before the camera punches in, so
   * the lens never lands on her while she is still lying.
   */
  pose: [REST_U, REST_U + 0.35],
  /** The doll lets go of the top edge, falls and arrives over the hand (before the camera is done). */
  doll: [REST_U, REST_U + 0.45],
  /**
   * The ground goes white behind the dragon: a flash that starts on the bite and is complete before
   * the dragon's head reaches the lens (the clip's 3.7 s), so it passes over a white screen.
   */
  white: [REST_U + 1.95, REST_U + 2.2],
  /** Then a white over everything takes Selena too, and the actors are gone by the end of it. */
  front: [REST_U + 2.5, REST_U + 2.7],
  /** The white over the canvas hands over to the one under it (the same colour), at the end. */
  frontOut: [REST_U + 2.75, STORY],
  /** In SCREENS past the section's end (its tail): the white layer leaves, under the voices' own ground. */
  whiteOut: [0.25, 0.5],
} as const;

/** How long one word takes to come in, in seconds. */
export const WORD_IN = 0.35;

/**
 * Seconds of the story to seconds of the clip: the clip starts at the first key and ends at the
 * last. The camera swing carries the first second of it (fast), the hover of the doll (1.2 to 2.6 s)
 * plays at twice the speed, the eat (2.6 to 3.5 s) a little faster than real, and the dragon's pass
 * (3.5 to 3.95 s) a little slower, so the big sweep is seen. No dead time after the pass: the white
 * follows it at once.
 */
export const FILM_KEYS: ReadonlyArray<readonly [u: number, t: number]> = [
  [REST_U + 0.5, 0],
  [REST_U + 0.85, 1.2],
  [REST_U + 1.4, 2.6],
  [REST_U + 1.55, 2.95],
  [REST_U + 1.95, 3.5],
  [REST_U + 2.5, 3.95],
];

/** The end of the clip we play: the dragon has left the frame at 3.9 s (`BAKED.pass.outAt`). */
export const FILM_END = 3.95;

/** The clip time in seconds for a story time, 0 before the first key and `FILM_END` after the last. */
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

/** The story time for a clip time (the inverse of `filmTime`), for the probes and the tests. */
export function storyAtFilm(t: number): number {
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

/**
 * All the beats for the story time `u`, written into `out`. `tail` is how far the page has gone past
 * the section's end, in screens: the white layer leaves in it, scroll linked, under the next ground.
 */
export function beatsAt(u: number, out: Beats = newBeats(), tail = 0): Beats {
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
  out.whiteOut = smooth(seg(tail, AT.whiteOut[0], AT.whiteOut[1]));
  out.film = out.camera >= 1;
  out.live = u <= AT.restEnd + 1e-6;
  out.actors = u < AT.front[1];
  return out;
}

/**
 * The white layer lets go by the clock, not the scroll: once the page is `WHITE_LEAVE_AT` screens
 * into the tail it leaves over `WHITE_LEAVE_SECONDS`. The voices' entrance runs at the same moment,
 * so the waves come up behind its title while it comes in. The scroll's own fade (`whiteOut`) stays
 * as the fallback that has it gone by the end of the tail whatever the clock did.
 */
export const WHITE_LEAVE_AT = 0.04;
export const WHITE_LEAVE_SECONDS = 0.7;

/**
 * The clock of the white's leaving: `c` is 0 (whole) to 1 (gone), `tail` how far the page is past the
 * section's end in screens, `dt` the frame's seconds. It moves toward 1 past `WHITE_LEAVE_AT` and
 * back toward 0 before it, at the same rate (a scroll up brings the white back as fast as it left).
 */
export function stepWhite(c: number, tail: number, dt: number): number {
  const step = Math.max(0, dt) / WHITE_LEAVE_SECONDS;
  return clamp01(tail > WHITE_LEAVE_AT ? c + step : c - step);
}
