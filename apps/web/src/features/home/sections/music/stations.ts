/**
 * The stations and the zones of the music section (round three: scroll based, with an idle snap).
 * Pure and import free on purpose: `index.ts` reads it, and `index.ts` must never reach
 * `kernel/where.ts`.
 *
 * Two scroll zones carry `local`, the value `update` gets, from station to station, with the visitor's
 * own scroll as the clock, down and up (`kernel/scrub.ts` finishes a zone the visitor leaves half way):
 *
 *   0       the pair stands in the bottom corners (J10), the screen is empty
 *   STAND   the gramophone and the crate have been dragged in and stand. The visitor picks a record
 *           here with the page free to scroll (the rest). The pick, the disc, the needle and the
 *           song are interactions on their own clock, not scenes of the scroll.
 *   1       the props are dragged out, the pair has risen to the top left (J11)
 *
 * Nothing holds the page and nobody can be trapped: a zone is only the scroll.
 */
import { zoneTable } from "../zone-table";

export const STAND = 0.5;

/** The lengths, in screens. One place to tune them. */
export const LENGTHS = { arrive: 1.2, stand: 0.8, exit: 0.9 } as const;

const TABLE = zoneTable(0, [
  { zone: LENGTHS.arrive, to: STAND },
  { rest: LENGTHS.stand },
  { zone: LENGTHS.exit, to: 1 },
]);

/** The section's length in screens (`index.ts`). */
export const MUSIC_SCREENS = TABLE.screens;
export const MUSIC_PLAYS = TABLE.plays;
/** Where each zone lies, in screens from the section's start. */
export const MUSIC_ZONES = TABLE.zones;
