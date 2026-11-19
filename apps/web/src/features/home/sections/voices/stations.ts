/**
 * The stations and the zones of the voices section (round three: scroll based, with an idle snap).
 * Pure and import free on purpose: `index.ts` reads it, and `index.ts` must never reach
 * `kernel/where.ts`.
 *
 * Two scroll zones carry `local`, the value `update` gets, around a long rest. Both ways: scrolling
 * down brings the page in and takes it out, scrolling up does the reverse, and the kernel finishes a
 * zone the visitor leaves half way (`kernel/scrub.ts`).
 *
 *   0       white, the pair off screen at the two edges (J9)
 *   REST_V  the title, the chooser, the eight lines and the art stand (the rest: the visitor listens,
 *           chooses an Aspirant, and scrolls on whenever they like). It is long because it is text.
 *   1       the list has gone and the pair stands in the bottom corners (J10)
 */
import { zoneTable } from "../zone-table";

/** The rest station: every part is in (the last row is whole at about 0.29). */
export const REST_V = 0.3;

/** The lengths, in screens. One place to tune them. */
export const LENGTHS = { enter: 0.7, rest: 1.0, leave: 0.7 } as const;

const TABLE = zoneTable(0, [
  { zone: LENGTHS.enter, to: REST_V },
  { rest: LENGTHS.rest },
  { zone: LENGTHS.leave, to: 1 },
]);

/** The section's length in screens (`index.ts`). */
export const VOICES_SCREENS = TABLE.screens;
export const VOICES_PLAYS = TABLE.plays;
/** Where each zone lies, in screens from the section's start. */
export const VOICES_ZONES = TABLE.zones;
