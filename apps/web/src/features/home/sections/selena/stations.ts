/**
 * The stations and the zones of the Selena section (round three: scroll based, with an idle snap).
 * Pure and import free on purpose: `index.ts` reads it, and `index.ts` must never reach
 * `kernel/where.ts` (a cycle through the registry).
 *
 * The story has its own unit. One unit `u` is one second of the story, so a beat written in `u` does
 * not change when the section's length in screens does. The virtual `local` the kernel hands to
 * `update` is `u / STORY`, and the scroll carries it through the zones:
 *
 *   zone one   0.7 screens   the drawer, its words and the dragon come in, the aurora rises (u 0 to REST_U)
 *   rest       0.8 screens   Selena and the dragon in the room, fully interactive, the words to read
 *   zone two   2.4 screens   the out animation (round seven, `out.ts`): the clip `city_intercation02`
 *                            plays by the scroll, her hand reaches up, takes a white sheet by its edge
 *                            and pulls it down over the screen (u REST_U to STORY). Down plays it, up
 *                            plays it back.
 *   rest       0.3 screens   white, the first frame of the voices (the bar's ink turns here)
 *
 * A visitor who stops inside a zone is carried to its nearer end by the kernel (`kernel/scrub.ts`).
 */
import { zoneTable } from "../zone-table";

/** The rest station, in seconds of the story. */
export const REST_U = 1.0;
/** The whole story, in seconds. Zone one is REST_U of it, zone two is the rest. */
export const STORY = 4;
/** The rest station as a `local`. */
const REST_V = REST_U / STORY;

/** The lengths, in screens. One place to tune them. */
const LENGTHS = { enter: 0.7, rest: 0.8, film: 2.4, white: 0.3 } as const;

const TABLE = zoneTable(0, [
  { zone: LENGTHS.enter, to: REST_V },
  { rest: LENGTHS.rest },
  { zone: LENGTHS.film, to: 1 },
  { rest: LENGTHS.white },
]);

/** The section's length in screens (`index.ts`). */
export const SELENA_SCREENS = TABLE.screens;
export const SELENA_PLAYS = TABLE.plays.map((play, index) =>
  // The way out (the film) is the scroll's, and only the scroll's: the page is not finished by itself
  // in it (the owner, 24 Nov 2026), and the kernel gives the scene a top speed through it.
  index === 1 ? { ...play, seconds: 7.2, noSnap: true } : play,
); /** A control taking the keyboard focus lands in the middle of the rest, where the words show. */
export const SELENA_FOCUS = (LENGTHS.enter + LENGTHS.rest / 2) / SELENA_SCREENS;
