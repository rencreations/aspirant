/**
 * The stations and the triggers of the Selena section (round two: a played scene, not a scrubbed
 * one). Pure and import free on purpose: `index.ts` reads it, and `index.ts` must never reach
 * `kernel/where.ts` (a cycle through the registry).
 *
 * The story runs on its own clock. One unit `u` is one second of a play, so a beat written in `u`
 * is a beat written in seconds, whatever the section's length in screens is. The virtual `local`
 * the kernel hands to `update` is `u / STORY`.
 *
 *   u 0           the list's last frame (J8): the sky, the doll hanging
 *   0 to REST_U   play one, the drawer, its words and the dragon come in
 *   REST_U        the rest: Selena and the dragon in the room, fully interactive
 *   to STORY      play two, the doll falls, the camera swings, the dragon eats her and sweeps past
 *                 the lens over white, and the screen ends white (the first frame of the voices)
 */
import type { HomePlay } from "../../kernel/plays";

/** The rest station, in seconds of the story. */
export const REST_U = 1.0;
/** The whole story, in seconds. The first play is REST_U long, the second is the rest of it. */
export const STORY = 4.2;
/** The rest station as a `local`. */
export const REST_V = REST_U / STORY;

/** Where the plays fire, as a share of the section's range. */
export const AT_ENTER = 0.12;
/**
 * The film fires half a screen before the end at the latest (`1 - 0.5 / screens`), so it has ended
 * before the voices' lead begins to run and the top bar turns for the white right after it.
 */
export const AT_FILM = 0.66;

export const SELENA_PLAYS: readonly HomePlay[] = [
  { at: AT_ENTER, from: 0, to: REST_V, seconds: REST_U, ease: "linear", back: 0.7 },
  { at: AT_FILM, from: REST_V, to: 1, seconds: STORY - REST_U, ease: "linear", back: 0.6 },
];
