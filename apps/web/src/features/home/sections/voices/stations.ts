/**
 * The stations of the voices section (round three: scroll based, with an idle snap; 25 Nov 2026: the
 * way in is a trigger). Pure and import free on purpose: `index.ts` reads it, and `index.ts` must
 * never reach `kernel/where.ts`.
 *
 * The way in is a clock play, not a scroll zone (the owner, 25 Nov 2026): when the white of Selena's
 * way out has covered the screen and the scroll reaches the first threshold, the title, the chooser,
 * the eight lines, the art and the two drones come in by themselves, and the page is held until they
 * stand. Going back up across the threshold plays it the other way. The way out is still a scroll
 * zone, both ways, and the kernel finishes a zone the visitor leaves half way (`kernel/scrub.ts`).
 *
 *   0       white, the pair off screen at the two edges (J9)
 *   REST_V  the title, the chooser, the eight lines and the art stand (the rest: the visitor listens,
 *           chooses an Aspirant, and scrolls on whenever they like). It is long because it is text.
 *   1       the list has gone and the pair stands in the bottom corners (J10)
 */
import { zoneTable } from "../zone-table";
import type { HomePlay } from "../../kernel/plays";

/** The rest station: every part is in (the last row is whole at about 0.29). */
export const REST_V = 0.3;

/** The lengths, in screens. One place to tune them. `arrive` is the white before the trigger fires. */
export const LENGTHS = { arrive: 0.05, rest: 1.0, leave: 0.7 } as const;

/**
 * How far in front of the way in the screen is already white (screens): Selena's wipe covers the screen
 * at 95 percent of her film, which ends 0.35 screens before the threshold.
 */
const AUTO_REACH = 0.46;

/** How long the way in runs, in seconds (the way back takes 0.7 of it). */
export const ENTER_SECONDS = 1.9;

const LEAVE = zoneTable(REST_V, [
  { rest: LENGTHS.arrive + LENGTHS.rest },
  { zone: LENGTHS.leave, to: 1 },
]);

/** The section's length in screens (`index.ts`). */
export const VOICES_SCREENS = LEAVE.screens;
/** The way in (a clock play at the trigger), then the way out (a scroll zone). */
export const VOICES_PLAYS: readonly HomePlay[] = [
  {
    at: LENGTHS.arrive / LEAVE.screens,
    from: 0,
    to: REST_V,
    seconds: ENTER_SECONDS,
    ease: "inOutSoft",
    // A visitor who lets go in the white in front of it is carried on, and it starts by itself: the white
    // has covered the screen from about 0.46 screens before the threshold (Selena's wipe ends at 95 percent
    // of her film, `../selena/timeline.ts`), the end of her film included.
    auto: AUTO_REACH,
  },
  ...LEAVE.plays,
];
/** Where the way out lies, in screens from the section's start. */
export const VOICES_ZONES = LEAVE.zones;
