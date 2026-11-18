import type { HomePlay } from "../../kernel/plays";

import { BEAT_SPAN, T } from "./beats";

/**
 * The bend section is three triggered scenes with a rest after each (`kernel/plays.ts`). `local` is
 * the beats' clock (`beats.ts`, `local * BEAT_SPAN` beats), not the scroll. Pure data: the registry
 * entry (`index.ts`) and the runtime read it, and nothing here imports the registry.
 *
 *   rest 0  Tetra reads (the chase's last frame, joint J13)
 *   play 1  she closes the book, stands, bends earth, air, water and fire, and the wall of fan art
 *           is thrown in                                                     (about 2.7 s)
 *   rest 1  the wall stands: "Fan art", "See all fanart", the credits on hover
 *   play 2  the wall gathers into a ring, the ring turns and is thrown away, the ten splash arts
 *           take a spiral round her                                          (about 2.7 s)
 *   rest 2  the spiral stands: "Artwork", "See all artwork"
 *   play 3  the spiral turns to the drone's paper, the drone comes out of it, flies to her, pats
 *           her head, they hug and go to the lower left                      (about 2.3 s)
 *   rest 3  Tetra and the drone at the lower left (joint J14, the archive starts from it)
 */

/** The section's length in screens: a short lead-in, two dwells of 0.6 screen, and the archive's lead. */
export const BEND_SCREENS = 2;

/** Where each scene fires, in screens from the start of the section. */
export const FIRE_AT: readonly [number, number, number] = [0.4, 0.95, 1.5];

/** The beat each rest stands on (the value of the clock after the scene before it). */
export const REST_BEATS: readonly [number, number, number, number] = [
  0,
  T.holdTo,
  T.restArt,
  T.goTo,
];

export const BEND_PLAYS: readonly HomePlay[] = [
  {
    at: FIRE_AT[0] / BEND_SCREENS,
    from: REST_BEATS[0] / BEAT_SPAN,
    to: REST_BEATS[1] / BEAT_SPAN,
    seconds: 2.7,
    ease: "linear",
    back: 0.55,
  },
  {
    at: FIRE_AT[1] / BEND_SCREENS,
    from: REST_BEATS[1] / BEAT_SPAN,
    to: REST_BEATS[2] / BEAT_SPAN,
    seconds: 2.6,
    ease: "linear",
    back: 0.55,
  },
  {
    at: FIRE_AT[2] / BEND_SCREENS,
    from: REST_BEATS[2] / BEAT_SPAN,
    to: REST_BEATS[3] / BEAT_SPAN,
    seconds: 2.3,
    ease: "linear",
    back: 0.55,
  },
];

/**
 * Where, in screens from the start of the section, the page stands to show rest `k` (1 to 3): the
 * middle of its dwell. A control that takes the keyboard focus moves the page here, and the plays
 * rest on the position (no scene fires on the way).
 */
export function restScreens(k: 1 | 2 | 3): number {
  const from = FIRE_AT[k - 1]!;
  const to = k === 3 ? BEND_SCREENS : FIRE_AT[k];
  return (from + to) / 2;
}
