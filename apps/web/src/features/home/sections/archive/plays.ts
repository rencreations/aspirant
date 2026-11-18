import type { HomePlay } from "../../kernel/plays";

/**
 * The archive is one triggered scene and then the scroll. Pure data: the registry entry
 * (`index.ts`) and the route read it, and nothing here imports the registry.
 *
 *   rest 0   Tetra and the drone at the lower left (joint J14, the bend section's end)
 *   play     Tetra waves and runs off, the drone flies up over the first cover, the title and the
 *            ten covers rise in (about 1.8 s, the scroll is held)
 *   scroll   the tour: the drone rests over each room in turn and the row slides under it (the
 *            visitor drives it: it is a list, so it stays linked to the scroll)
 *   scroll   the covers lift away, the footer's card rises and the drone flies down to its ring
 */

/** The section's length in screens: the entry's threshold, the tour, and the way out. */
export const ARCHIVE_SCREENS = 2.3;
/** Where the entry fires, in screens from the start: the length of the entry on the route's own clock. */
export const ENTRY_SCREENS = 0.4;
/** The way out (the covers lift, the drone flies down to the footer's ring), in screens. */
export const EXIT_SCREENS = 0.7;

/** The local value after the entry: the route's clock then goes on with the scroll (`routeS`). */
const ENTRY_LOCAL = ENTRY_SCREENS / ARCHIVE_SCREENS;

export const ARCHIVE_PLAYS: readonly HomePlay[] = [
  {
    at: ENTRY_LOCAL,
    from: 0,
    to: ENTRY_LOCAL,
    seconds: 1.8,
    ease: "inOutSoft",
    back: 0.7,
  },
];
