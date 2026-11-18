/**
 * The stations and the triggers of the funny section (round two: three played scenes). Pure and
 * import free on purpose: `index.ts` reads it, and `index.ts` must never reach `kernel/where.ts`.
 *
 * The story is a `local` that the plays carry from station to station on a clock; `timeline.ts` has
 * what happens at each value.
 *
 *   0       the duo hover high at the left (J11), the stage is empty
 *   R1      Tetra stands and flies her kite, the two drones watch her (a rest)
 *   R2      the dragon has crossed and cut the rope, Tetra has run off after it, the drones are confused
 *   1       the two drones in the middle, big, questioning each other, the words and the button (a rest)
 *
 * After the section's end the page rides up in the tail (scroll linked): the duo and the words leave.
 */
import type { HomePlay } from "../../kernel/plays";

export const R1 = 0.12;
export const R2 = 0.5;

/** Where the plays fire, as a share of the section's range. */
export const AT_ARRIVE = 0.05;
export const AT_CROSS = 0.32;
export const AT_ASK = 0.64;

/** How long each play runs, in seconds. */
export const SECONDS = { arrive: 0.6, cross: 2.6, ask: 1.6 } as const;

export const FUNNY_PLAYS: readonly HomePlay[] = [
  { at: AT_ARRIVE, from: 0, to: R1, seconds: SECONDS.arrive, ease: "linear", back: 0.7 },
  { at: AT_CROSS, from: R1, to: R2, seconds: SECONDS.cross, ease: "linear", back: 0.6 },
  { at: AT_ASK, from: R2, to: 1, seconds: SECONDS.ask, ease: "linear", back: 0.6 },
];
