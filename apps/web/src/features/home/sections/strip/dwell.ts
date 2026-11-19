/**
 * The scroll the strip takes, in screens (round three, 20 Nov 2026). Scenes follow the scroll again
 * (`kernel/scrub.ts`), except the two the owner named as triggers: the small frame growing into the
 * big window and the big window becoming the orbit of "Official animations" stay on a clock. So the
 * strip is, in order:
 *
 *   zone    the small frame's words come in, scrubbed by the scroll (`WORDS`)
 *   rest    the small frame with its words and its button (`small`)
 *   play    the window (clock, `window` rest after it)
 *   play    the orbit (clock, `orbit` rest after it: the heading, the line and the button)
 *   zone    the exit: the set flies off to the bottom right as the visitor scrolls on to the next
 *           section (`EXIT`); the page finishes it by itself when the visitor stops inside it
 *
 * The rests that carry words or a button are longer (the owner: "so user need to scroll more"); a
 * rest between two clock plays is short. Pure, no imports (the section's `index.ts` reads it).
 */
export const STRIP_ZONES = { words: 0.45, exit: 1.0 } as const;

/** The scroll the visitor spends on each rest before the next scene, in screens. */
export const STRIP_DWELL = { small: 0.7, window: 0.6, orbit: 1.0 } as const;

/** Where each scene starts, in screens after the section's start. */
export const STRIP_AT_SCREENS = {
  window: STRIP_ZONES.words + STRIP_DWELL.small,
  orbit: STRIP_ZONES.words + STRIP_DWELL.small + STRIP_DWELL.window,
  exit: STRIP_ZONES.words + STRIP_DWELL.small + STRIP_DWELL.window + STRIP_DWELL.orbit,
} as const;

/** The section's length in screens: the last zone is the exit, which ends at the section's end. */
export const STRIP_SCREENS = STRIP_AT_SCREENS.exit + STRIP_ZONES.exit;

/** Where each scene starts, as a fraction of the section. */
export const STRIP_AT = {
  window: STRIP_AT_SCREENS.window / STRIP_SCREENS,
  orbit: STRIP_AT_SCREENS.orbit / STRIP_SCREENS,
  exit: STRIP_AT_SCREENS.exit / STRIP_SCREENS,
} as const;

/** The span of the two zones, as fractions of the section. */
export const STRIP_SPAN = {
  words: STRIP_ZONES.words / STRIP_SCREENS,
  exit: STRIP_ZONES.exit / STRIP_SCREENS,
} as const;

/**
 * Where the page goes for a control that is not on screen (a fraction of the section): inside the rest
 * that shows the control, so no play fires and no zone moves on the way.
 */
export const STRIP_FOCUS_AT = {
  small: (STRIP_ZONES.words + 0.5 * STRIP_DWELL.small) / STRIP_SCREENS,
  window: (STRIP_AT_SCREENS.window + STRIP_DWELL.window * 0.6) / STRIP_SCREENS,
  hold: (STRIP_AT_SCREENS.orbit + STRIP_DWELL.orbit * 0.55) / STRIP_SCREENS,
} as const;

/** The same places in screens from the section's start, for `data-home-focus-at`. */
export const focusScreensOf = (share: number): string => (share * STRIP_SCREENS).toFixed(2);

/**
 * The ranges of the scroll (fractions of the section) in which each kind of control is on screen: the
 * small frame from the lead to the window's threshold, the window from there to the orbit's, the
 * orbit to the first third of the exit (its words have left by then).
 */
export const STRIP_FOCUS_RANGE = {
  small: [-0.3 / STRIP_SCREENS, STRIP_AT.window - 0.01],
  window: [STRIP_AT.window, STRIP_AT.orbit - 0.01],
  hold: [STRIP_AT.orbit, STRIP_AT.exit + 0.3 * STRIP_SPAN.exit],
} as const;
