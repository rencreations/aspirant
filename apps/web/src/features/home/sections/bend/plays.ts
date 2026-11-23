import type { HomePlay } from "../../kernel/plays";

import { BEAT_SPAN, REST_BEFORE_EDGE, T } from "./beats";

/**
 * The bend section is ten scroll zones with a rest after each (`kernel/scrub.ts`). `local` is the
 * beats' clock (`beats.ts`, `local * BEAT_SPAN` beats), not the scroll: the visitor scrolls for a
 * scene to play, up or down, and the pose stays where they stop. Pure
 * data: the registry entry (`index.ts`) and the runtime read it, and nothing here imports the registry.
 *
 *   rest 0   Tetra reads (the chase's last frame, joint J13)
 *   zone 1   she closes the book, puts it away and stands in the middle
 *   zone 2   earth: she stamps, the dust and boulders come, the first wave of posters is thrown in
 *   zone 3   air: the wind, the second wave
 *   zone 4   water: the third wave
 *   zone 5   fire: the fourth wave, the last of the wall
 *   zone 6   she stands down and the wall settles: "Fan art" and "See all fanart" come in
 *   rest 6   the wall stands (a long rest: the words, the credits on hover)
 *   zone 7   the wall gathers into a ring around her and the ring turns
 *   zone 8   the ring is thrown away and the ten splash arts take a spiral round her
 *   rest 8   the spiral stands: "Artwork", "See all artwork" (a long rest)
 *   zone 9   the spiral turns to the drone's paper, the drone comes out of it
 *   zone 10  the drone flies to her, pats her head, they hug and go to the lower left
 *   rest 10  Tetra and the drone at the lower left (joint J14, the archive starts from it)
 *
 * Each stance has a rest of its own, formed (`REST_BEFORE_EDGE`): every picture of its wave has
 * landed and she wears the stance in full. A rest is where the zone before it ends, so the pictures are
 * never left in the air.
 */

/** The beat each rest stands on (the value of the clock at the end of the zone before it). */
export const REST_BEATS: readonly number[] = [
  0,
  // The book is shut and she has arrived on the stage.
  T.bendFrom - REST_BEFORE_EDGE,
  // The four stances, each formed.
  T.bendFrom + 1 * T.wave - REST_BEFORE_EDGE,
  T.bendFrom + 2 * T.wave - REST_BEFORE_EDGE,
  T.bendFrom + 3 * T.wave - REST_BEFORE_EDGE,
  T.bendFrom + 4 * T.wave - REST_BEFORE_EDGE,
  // The wall stands.
  T.holdTo,
  // The ring, gathered and turning.
  T.ringTo - REST_BEFORE_EDGE,
  // The spiral stands.
  T.restArt,
  // The drone is out of its paper.
  T.popTo,
  // The end.
  T.goTo,
];

/**
 * Where each zone stands and how long it is, in screens from the start of the section. A gap between
 * two zones is a short rest, except for the reading space at the fan art wall. The artwork spiral advances as it arrives.
 */
export const ZONE_SCREENS: ReadonlyArray<{ at: number; len: number }> = [
  { at: 0, len: 1.05 },
  { at: 1.1, len: 0.7 },
  { at: 1.9, len: 0.7 },
  { at: 2.7, len: 0.7 },
  { at: 3.5, len: 0.7 },
  { at: 4.3, len: 0.5 },
  { at: 5.8, len: 0.8 },
  { at: 6.6, len: 1.05 },
  { at: 7.65, len: 1.85 },
  { at: 9.5, len: 0.8 },
];

/** The section's length in screens: the last zone ends with it (the archive starts from that rest). */
export const BEND_SCREENS = 10.3;

const ZONE_SECONDS = 0.9;

export const BEND_PLAYS: readonly HomePlay[] = ZONE_SCREENS.map((z, i): HomePlay => ({
  at: z.at / BEND_SCREENS,
  span: z.len / BEND_SCREENS,
  from: REST_BEATS[i]! / BEAT_SPAN,
  to: REST_BEATS[i + 1]! / BEAT_SPAN,
  seconds: ZONE_SECONDS,
  ease: "linear",
}));

/**
 * Where, in screens from the start of the section, the page stands to show a rest with words (1 the
 * wall, 2 the spiral, 3 the end): the middle of its dwell. A control that takes the keyboard focus
 * moves the page here, and no zone moves on the way.
 */
export function restScreens(k: 1 | 2 | 3): number {
  if (k === 3) return BEND_SCREENS - 0.05;
  const zone = k === 1 ? 5 : 7;
  const from = ZONE_SCREENS[zone]!;
  const next = ZONE_SCREENS[zone + 1]!;
  return (from.at + from.len + next.at) / 2;
}
