/**
 * The descent's numbers (round six, 20 Nov 2026). Pure and import free on purpose: the section's
 * `index.ts` and the list's `index.ts` both read it, and neither may reach `kernel/where.ts`.
 *
 * The descent is a plain scroll linked passage with no plays: nothing rests in it, nothing snaps in
 * it. It runs from the strip's exit (its lead) to the list, and the list's lead lies over its last
 * `LIST_LEAD` screens, so the character section rises from the bottom while the pair are still
 * descending, and the pair dock at the bottom right where the list's lead ends.
 */

/** Screens before the descent's start in which it already runs: the strip's exit, the film flying off. */
export const DESCENT_LEAD = 0.6;

/** The descent's length in screens. `local` 0 to 1 runs over it. */
export const DESCENT_SCREENS = 5.0;

/**
 * The list's lead in screens. The list's `index.ts` takes this number, so that the list's rise
 * (a translateY from the bottom of the screen to its place) and the pair's arrival at the dock end
 * at the same scroll: the descent's end, the list's start.
 */
export const LIST_LEAD = 1.6;

/** The descent's `u` (screens from its start) at which the list's rise begins. */
export const LIST_RISE_AT_U = DESCENT_SCREENS - LIST_LEAD;

/** The first `u` of the pair's route (above the top edge, out of sight): the start of the descent's lead. */
export const PAIR_FROM_U = -DESCENT_LEAD;
