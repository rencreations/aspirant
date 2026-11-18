/**
 * The stations and the triggers of the voices section (round two). Pure and import free on purpose:
 * `index.ts` reads it, and `index.ts` must never reach `kernel/where.ts`.
 *
 * Two short plays carry `local`, the value `update` gets, on a clock while the page is held:
 *
 *   0       white, the pair off screen at the two edges (J9)
 *   REST_V  the title, the chooser, the eight lines and the art stand (the rest: the visitor listens,
 *           chooses an Aspirant, and scrolls on whenever they like)
 *   1       the list has gone and the pair stands in the bottom corners (J10)
 */
import type { HomePlay } from "../../kernel/plays";

/** The rest station: every part is in (the last row is whole at about 0.29). */
export const REST_V = 0.3;

/** Where the plays fire, as a share of the section's range. */
export const AT_ENTER = 0.04;
export const AT_LEAVE = 0.78;

/** How long each play runs, in seconds. */
export const SECONDS = { enter: 0.9, leave: 0.8 } as const;

export const VOICES_PLAYS: readonly HomePlay[] = [
  { at: AT_ENTER, from: 0, to: REST_V, seconds: SECONDS.enter, ease: "linear", back: 0.7 },
  { at: AT_LEAVE, from: REST_V, to: 1, seconds: SECONDS.leave, ease: "linear", back: 0.7 },
];
