/**
 * The beats of the Selena section as pure functions of the story clock. `u` is the story's own
 * time in seconds (`stations.ts`: one unit is one second of a play), negative in the lead, `STORY`
 * at the end. Everything here is a function of `u` and nothing else, so a jump of the scroll gives
 * the picture a played scene gives.
 *
 *   0 to 1.0      zone one: the drawer opens on the left, its words come, the dragon glides in
 *   1.0           the rest: Selena and Silverbolt in `city_idle`, the pair docked at the lower right
 *   1.0 to 4.0    zone two, the out animation (`out.ts`, a function of the zone's own progress `o`):
 *                 the drawer and the words leave, the clip plays, the hand takes the white sheet
 *                 and pulls it down, the pair fly off, the screen is white
 *   4.0 and after the white rest and, in the section's tail, the white layer leaves under the voices
 */

import { sectionScreens } from "../../kernel/where";

import { newOut, outAt, seg, smooth, type OutBeats } from "./out";
import { REST_U, STORY } from "./stations";

export { seg, smooth, mix } from "./out";

/** The section's length is the registry's (`kernel/where.ts`): change it in `index.ts`. */
export const selenaScreens = (): number => sectionScreens("selena");

/** Where each beat lies, in seconds of the story. One place to tune them. */
export const AT = {
  /** The drawer's panel slides in; the words follow inside it, one after another. */
  drawer: [0, 0.7],
  /** The first word starts here; each next one 0.1 s later, each takes `WORD_IN`. */
  words: [0.15, 0.5],
  /** The dragon glides in from the right edge. */
  dragon: [0, 0.95],
  /** The room rests from here (the drawer is open) until the out animation starts. */
  restEnd: REST_U,
  /** The drawer and the words leave in the first part of the out animation (`out.ts`, `AT.words`). */
  /**
   * In SCREENS past the section's end (its tail): the white layer leaves with the scroll, as the
   * voices' entrance comes in, so its waves come up behind its title (scroll based, both ways).
   */
  whiteOut: [0.04, 0.45],
} as const;

/** How long one word takes to come in, in seconds. */
export const WORD_IN = 0.35;

export interface Beats {
  /** The drawer's panel, 0 (away) to 1 (open). */
  drawer: number;
  /** The dragon's glide in, 0 (off the right edge) to 1 (in its place). */
  dragon: number;
  /** The progress of the out animation, 0 (the room) to 1 (the white screen). */
  o: number;
  /** The out animation's own beats (`out.ts`). */
  out: OutBeats;
  /** The white under the canvas, 0 to 1 (the paper itself: the voices' ground). */
  white: number;
  /** The white over the canvas, 0 to 1: it takes the sheet's place for the last moment. */
  front: number;
  /** The white layer's own fade out in the tail, 0 (still there) to 1 (gone). */
  whiteOut: number;
  /** The interactive part: the room. */
  live: boolean;
  /** The actors are drawn at all (false once the screen is white). */
  actors: boolean;
}

export function newBeats(): Beats {
  return {
    drawer: 0,
    dragon: 0,
    o: 0,
    out: newOut(),
    white: 0,
    front: 0,
    whiteOut: 0,
    live: true,
    actors: true,
  };
}

/**
 * All the beats for the story time `u`, written into `out`. `tail` is how far the page has gone past
 * the section's end, in screens: the white layer leaves in it, scroll linked, under the next ground.
 */
export function beatsAt(u: number, out: Beats = newBeats(), tail = 0): Beats {
  out.drawer = smooth(seg(u, AT.drawer[0], AT.drawer[1]));
  out.dragon = smooth(seg(u, AT.dragon[0], AT.dragon[1]));
  const o = seg(u, REST_U, STORY);
  out.o = o;
  outAt(o, out.out);
  // The drawer leaves with the words, in the first part of the out animation.
  out.drawer *= out.out.room;
  // The white: under the canvas it is the paper itself, whole as the sheet covers the screen; over
  // the canvas it holds the last moment while the sheet is taken off the stage.
  out.white = out.out.white;
  out.front = out.out.white * (1 - smooth(seg(o, 0.985, 1)));
  out.whiteOut = smooth(seg(tail, AT.whiteOut[0], AT.whiteOut[1]));
  out.live = u <= AT.restEnd + 1e-6;
  out.actors = o < 1 - 1e-6;
  return out;
}
