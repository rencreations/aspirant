/**
 * The stations and the zones of the funny section (round three: three scroll zones, with an idle
 * snap). Pure and import free on purpose: `index.ts` reads it, and `index.ts` must never reach
 * `kernel/where.ts`.
 *
 * The story is a `local` that the scroll carries from station to station through the zones, up and
 * down (`kernel/scrub.ts` finishes a zone the visitor leaves half way); `timeline.ts` has what happens
 * at each value.
 *
 *   0       the duo hover high at the left (J11), the stage is empty
 *   R1      Tetra stands and flies her kite, the two drones watch her (a short rest)
 *   R2      the dragon has crossed and cut the rope, Tetra has run off after it, the drones are confused
 *           (a short rest)
 *   1       the two drones in the middle, big, questioning each other, the words and the button (a
 *           long rest: it is text and a button)
 *
 * After the section's end the page rides up in the tail (scroll linked): the duo and the words leave.
 */
import { zoneTable } from "../zone-table";

export const R1 = 0.12;
export const R2 = 0.5;

/** The lengths, in screens. One place to tune them. */
export const LENGTHS = {
  arrive: 0.6,
  watch: 0.3,
  cross: 1.1,
  confused: 0.25,
  ask: 0.9,
  words: 0.9,
} as const;

const TABLE = zoneTable(0, [
  { zone: LENGTHS.arrive, to: R1 },
  { rest: LENGTHS.watch },
  { zone: LENGTHS.cross, to: R2 },
  { rest: LENGTHS.confused },
  { zone: LENGTHS.ask, to: 1 },
  { rest: LENGTHS.words },
]);

/** The section's length in screens (`index.ts`). */
export const FUNNY_SCREENS = TABLE.screens;
export const FUNNY_PLAYS = TABLE.plays;
/** Where each zone lies, in screens from the section's start. */
export const FUNNY_ZONES = TABLE.zones;
/** A control taking the keyboard focus lands in the middle of the last rest, where the words show. */
export const FUNNY_FOCUS = (FUNNY_ZONES[2]!.to + LENGTHS.words / 2) / FUNNY_SCREENS;
