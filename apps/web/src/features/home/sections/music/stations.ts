/**
 * The stations and the triggers of the music section (round two). Pure and import free on purpose:
 * `index.ts` reads it, and `index.ts` must never reach `kernel/where.ts`.
 *
 * Two plays carry `local`, the value `update` gets, from station to station on a clock while the
 * page is held:
 *
 *   0       the pair stands in the bottom corners (J10), the screen is empty
 *   STAND   the gramophone and the crate have been dragged in and stand. The visitor picks a record
 *           here with the page free to scroll (the rest)
 *   1       the props are dragged out, the pair has risen to the top left (J11)
 *
 * The lock of round one (a hold released by a gesture, a key, a button or six seconds of the song) is
 * gone: the play holds the page for its few seconds, and the stand never holds it.
 */
import type { HomePlay } from "../../kernel/plays";

export const STAND = 0.5;

/** Where the plays fire, as a share of the section's range. */
export const AT_ARRIVE = 0.07;
export const AT_EXIT = 0.76;

/** How long each play runs, in seconds: the pair zips off (0.5 s), then each prop takes about 1.5 s. */
export const SECONDS = { arrive: 3.2, exit: 1.5 } as const;

export const MUSIC_PLAYS: readonly HomePlay[] = [
  { at: AT_ARRIVE, from: 0, to: STAND, seconds: SECONDS.arrive, ease: "linear", back: 0.6 },
  { at: AT_EXIT, from: STAND, to: 1, seconds: SECONDS.exit, ease: "linear", back: 0.6 },
];
