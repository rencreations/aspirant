/**
 * The stations of the voices section (round three: scroll based, with an idle snap; 25 Nov 2026: the
 * way in is a trigger; 26 Nov 2026: it fires the moment the white has covered the screen). Pure and
 * import free on purpose: `index.ts` reads it, and `index.ts` must never reach `kernel/where.ts`.
 *
 * The way in is a clock play, not a scroll zone (the owner, 25 and 26 Nov 2026): when the white of
 * Selena's way out has covered the whole screen, the scroll is held, the title, the chooser, the eight
 * lines, the art and the two drones come in by themselves, and the scroll is given back. That moment
 * is in Selena's film, a little before this section starts, so the play fires in the section's lead
 * (a negative `at`) and on the picture the visitor sees (`drawn`). Going back up across it plays it
 * the other way, over the white. The way out is still a scroll zone, both ways, and the kernel
 * finishes a zone the visitor leaves half way (`kernel/scrub.ts`).
 *
 *   -WHITE_BEFORE  the white has covered the screen
 *   + PAST_WHITE   a frame's move later, the way in fires (0 to REST_V on the clock)
 *   REST_V         the title, the chooser, the eight lines and the art stand (the rest: the visitor
 *                  listens, chooses an Aspirant, and scrolls on whenever they like). It is long because
 *                  it is text.
 *   1              the list has gone and the pair stands in the bottom corners (J10)
 */
import { zoneTable } from "../zone-table";
import type { HomePlay } from "../../kernel/plays";

/** The rest station: every part is in (the last row is whole at about 0.29). */
export const REST_V = 0.3;

/** The lengths, in screens. One place to tune them. The rest runs from the section's start. */
export const LENGTHS = { rest: 1.05, leave: 0.7 } as const;

/**
 * How far before the section's start the white of Selena's way out has covered the whole screen, in
 * screens. Her film zone is 2.4 screens and ends 0.3 screens before her end, and the white is whole at
 * 95.22 percent of it (her clip time 5.95 of 6.29, `../selena/timeline.ts`): 0.4147 screens. Kept a
 * hair under (`stations.test.ts` reads her timeline to hold it there).
 */
export const WHITE_BEFORE = 0.4146;

/**
 * How far past that point the way in fires (screens, 40 px on a 900 px screen). More than the scene
 * can move in one frame there (Selena's film speed 0.82 times the longest frame 0.05 s): going back up,
 * the frame that crosses the threshold still lands on the whole white, so the way back plays over it
 * and her white never comes back over the voices' art and drones while they leave.
 */
export const PAST_WHITE = 0.045;

/**
 * How far in front of the way in a visitor who lets go is carried on to it (screens): from where the
 * white covers all but a sliver at the screen's edge. Further up is Selena's film, the scroll's own.
 */
export const AUTO_REACH = PAST_WHITE + 0.03;

/** How long the way in runs, in seconds (the way back takes 0.7 of it). */
export const ENTER_SECONDS = 1.9;

const LEAVE = zoneTable(REST_V, [{ rest: LENGTHS.rest }, { zone: LENGTHS.leave, to: 1 }]);

/** The section's length in screens (`index.ts`). */
export const VOICES_SCREENS = LEAVE.screens;
/** The way in (a clock play in the lead, at the white), then the way out (a scroll zone). */
export const VOICES_PLAYS: readonly HomePlay[] = [
  {
    at: (PAST_WHITE - WHITE_BEFORE) / LEAVE.screens,
    from: 0,
    to: REST_V,
    seconds: ENTER_SECONDS,
    ease: "inOutSoft",
    // It starts when the white the visitor sees is whole (the scene's smoothed scroll, not only the real
    // one), and plays back over that same white when the real scroll goes back above it.
    drawn: true,
    // A visitor who lets go with the white all but whole is carried on, and it starts by itself.
    auto: AUTO_REACH,
  },
  ...LEAVE.plays,
];
/** Where the way out lies, in screens from the section's start. */
export const VOICES_ZONES = LEAVE.zones;
