/**
 * The scroll the visitor spends on each rest of the strip before the next scene fires (the owner,
 * 19 Nov: sections with text and information need a threshold, "so user need to scroll more").
 * It follows what the rest carries: the small frame has its words and a button, the window a play
 * button and two big words, the orbit the heading, a line and a button. Pure, no imports (the
 * section's `index.ts` reads it).
 */
export const STRIP_DWELL = { small: 0.9, window: 0.6, orbit: 1.0 } as const;

/** The section's length in screens: the three dwells, the last play fires at its end. */
export const STRIP_SCREENS = STRIP_DWELL.small + STRIP_DWELL.window + STRIP_DWELL.orbit;

/** Where each play fires, as a fraction of the section. */
export const STRIP_AT = {
  window: STRIP_DWELL.small / STRIP_SCREENS,
  orbit: (STRIP_DWELL.small + STRIP_DWELL.window) / STRIP_SCREENS,
} as const;

/**
 * Where the page goes for a control that is not on screen (a fraction of the section): the middle of
 * the dwell of the rest that shows the control, so no play fires on the way.
 */
export const STRIP_FOCUS_AT = {
  small: (0.28 * STRIP_DWELL.small) / STRIP_SCREENS,
  window: (STRIP_DWELL.small + STRIP_DWELL.window * 0.6) / STRIP_SCREENS,
  hold: (STRIP_DWELL.small + STRIP_DWELL.window + STRIP_DWELL.orbit * 0.55) / STRIP_SCREENS,
} as const;

/** The same places in screens from the section's start, for `data-home-focus-at`. */
export const focusScreensOf = (share: number): string => (share * STRIP_SCREENS).toFixed(2);

/**
 * The ranges of the scroll (fractions of the section) in which each kind of control is on screen: the
 * small frame from the lead to the window's threshold, the window from there to the orbit's, the
 * orbit to the end.
 */
export const STRIP_FOCUS_RANGE = {
  small: [-0.3 / STRIP_SCREENS, STRIP_AT.window - 0.01],
  window: [STRIP_AT.window, STRIP_AT.orbit - 0.01],
  hold: [STRIP_AT.orbit, 1],
} as const;
