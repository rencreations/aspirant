/**
 * The scroll the strip takes, in screens (round five, 20 Nov 2026). Scenes follow the scroll again
 * (`kernel/scrub.ts`), except one the owner named as a trigger: the small frame growing into the big
 * window stays on a clock. So the strip is, in order:
 *
 *   zone    the small frame's words come in, scrubbed by the scroll (`WORDS`)
 *   rest    the small frame with its words and its button (`small`)
 *   play    the window (clock, `window` rest after it)
 *   zone    the pull: the window becomes the orbit of the ten films under "Official animations for The
 *           Aspirants", scrubbed by the scroll (`pull`, round five: it was a clock trigger)
 *   rest    the orbit with the heading, the line and the button (`orbit`)
 *   zone    the exit: the set flies off to the bottom right as the visitor scrolls on to the next
 *           section (`EXIT`). It has no snap: the page is never finished by itself (`noSnap`)
 *
 * The rests that carry words or a button are longer (the owner: "so user need to scroll more"); the rest
 * after the window is short. Pure, no imports (the section's `index.ts` reads it).
 */
export const STRIP_ZONES = { words: 0.45, pull: 1.0, exit: 1.0 } as const;

/** The scroll the visitor spends on each rest before the next scene, in screens. */
export const STRIP_DWELL = { small: 0.7, window: 0.6, orbit: 1.0 } as const;

/** Where each scene starts, in screens after the section's start. */
export const STRIP_AT_SCREENS = {
  window: STRIP_ZONES.words + STRIP_DWELL.small,
  pull: STRIP_ZONES.words + STRIP_DWELL.small + STRIP_DWELL.window,
  exit:
    STRIP_ZONES.words +
    STRIP_DWELL.small +
    STRIP_DWELL.window +
    STRIP_ZONES.pull +
    STRIP_DWELL.orbit,
} as const;

/** The section's length in screens: the last zone is the exit, which ends at the section's end. */
export const STRIP_SCREENS = STRIP_AT_SCREENS.exit + STRIP_ZONES.exit;

/** Where each scene starts, as a fraction of the section. */
export const STRIP_AT = {
  window: STRIP_AT_SCREENS.window / STRIP_SCREENS,
  pull: STRIP_AT_SCREENS.pull / STRIP_SCREENS,
  exit: STRIP_AT_SCREENS.exit / STRIP_SCREENS,
} as const;

/** The span of the three zones, as fractions of the section. */
export const STRIP_SPAN = {
  words: STRIP_ZONES.words / STRIP_SCREENS,
  pull: STRIP_ZONES.pull / STRIP_SCREENS,
  exit: STRIP_ZONES.exit / STRIP_SCREENS,
} as const;

/**
 * Where the page goes for a control that is not on screen (a fraction of the section): inside the rest
 * that shows the control, so no play fires and no zone moves on the way.
 */
export const STRIP_FOCUS_AT = {
  small: (STRIP_ZONES.words + 0.5 * STRIP_DWELL.small) / STRIP_SCREENS,
  window: (STRIP_AT_SCREENS.window + STRIP_DWELL.window * 0.6) / STRIP_SCREENS,
  hold: (STRIP_AT_SCREENS.pull + STRIP_ZONES.pull + STRIP_DWELL.orbit * 0.55) / STRIP_SCREENS,
} as const;

/** The same places in screens from the section's start, for `data-home-focus-at`. */
export const focusScreensOf = (share: number): string => (share * STRIP_SCREENS).toFixed(2);

/**
 * The ranges of the scroll (fractions of the section) in which each kind of control is on screen: the
 * small frame from the lead to the window's threshold, the window from there to the pull's, the orbit
 * from three quarters of the pull (its words are in by then) to the first third of the exit (its words
 * have left by then).
 */
export const STRIP_FOCUS_RANGE = {
  small: [-0.3 / STRIP_SCREENS, STRIP_AT.window - 0.01],
  window: [STRIP_AT.window, STRIP_AT.pull - 0.01],
  hold: [STRIP_AT.pull + 0.75 * STRIP_SPAN.pull, STRIP_AT.exit + 0.3 * STRIP_SPAN.exit],
} as const;
