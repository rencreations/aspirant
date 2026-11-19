/**
 * The rows' scroll, in screens (round three, 20 Nov 2026). The section is a short dwell, where the
 * pictures slide with the scroll and nothing else happens, then the transition zone: the film's space,
 * the film, the clearing and the turn upright, all scrubbed by the scroll (`kernel/scrub.ts`: when the
 * visitor stops inside it the page finishes it by itself). Pure, no imports: the registry (`index.ts`)
 * and the runtime both read it.
 */

/** Screens of scroll where the pictures only slide (the rows have no words, so this is short). */
export const ROWS_DWELL = 0.4;
/** Screens of scroll the transition takes (the owner wants it short: about one screen and a bit). */
export const ROWS_ZONE = 1.5;
/**
 * Screens of rest after the zone: the film stands upright as the strip. The strip's lead (0.3) lies over
 * them and draws the same film, so the two sections never disagree and the zone never meets the strip's lead.
 */
export const ROWS_REST = 0.3;
/** The section's length in screens. */
export const ROWS_SCREENS = ROWS_DWELL + ROWS_ZONE + ROWS_REST;
/** How long the page takes to finish the zone by itself, for a full traverse (the idle snap). */
export const ROWS_ZONE_SECONDS = 1.5;
