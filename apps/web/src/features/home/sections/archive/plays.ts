import type { HomePlay } from "../../kernel/plays";

/**
 * The archive is scroll linked from end to end (round three): an entry that the visitor scrubs,
 * then the tour, then the way out. Pure data: the registry entry (`index.ts`) and the route read
 * it, and nothing here imports the registry.
 *
 *   0.0 to 0.1    rest (joint J14, the bend section's end): Tetra and the drone at the lower left
 *   entry         Tetra waves and runs off, the drone arcs up over the first cover, the title and the
 *                 ten covers rise in (one screen of manual scroll)
 *   tour          the drone rests over each room in turn and the row slides under it
 *   way out       the covers lift away and the light goes out; then the footer's card rises and the drone flies down to its ring
 */

/** The section's length in screens: the rest, the entry, the tour, and the way out. */
export const ARCHIVE_SCREENS = 3.8;
/** Where the entry begins, in screens from the start: the bend's last rest stands first. */
export const ENTRY_AT = 0.1;
/** The length of the entry, in screens of scroll. */
export const ENTRY_SCREENS = 1;
/**
 * The way out, in screens: the light goes out and the covers lift away. The footer's card is a sticky
 * stage in the page's flow and starts to rise one screen before the footer's start, so the way out is
 * long enough that the last cover has gone before that (25 Nov 2026, the owner: the archive is gone
 * first, then the footer shows). The drone waits where the tour left it until the card rises.
 */
export const EXIT_SCREENS = 1.5;

/**
 * The entry is the one scroll zone: it marks the first part of the tour. The route itself is a function
 * of the scene's scroll (`route.ts`), so the value of the zone is not read by the runtime.
 */
export const ARCHIVE_PLAYS: readonly HomePlay[] = [
  {
    at: ENTRY_AT / ARCHIVE_SCREENS,
    span: ENTRY_SCREENS / ARCHIVE_SCREENS,
    from: 0,
    to: ENTRY_SCREENS / ARCHIVE_SCREENS,
    seconds: 1,
    ease: "linear",
  },
];
