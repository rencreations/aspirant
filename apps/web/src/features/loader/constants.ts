/** Shortest time the loader stays up, so the field has time to condense into the title. */
export const MIN_DURATION_MS = 2400;
/** After this long the button is shown even if fonts or images have stalled. */
export const HARD_TIMEOUT_MS = 8000;
/** Fonts that never settle are abandoned after this long so the counter keeps moving. */
export const FONT_TIMEOUT_MS = 3500;
/** Progress (0 to 1) at which the glyph field starts to condense into the wordmark. */
export const FORM_START = 0.5;
/** Pause between progress reaching 100 and the title being declared formed. */
export const SETTLE_MS = 900;
/** The light reaches full cover this long after the visitor chooses to enter. */
export const FLASH_MS = 460;
/** Reduced motion uses a plain crossfade of this length instead of the burst. */
export const FADE_MS = 240;

export const DPR_CAP = 2;
/** Share of particles that build the wordmark. The rest drift as ambient glyphs. */
export const WORD_SHARE = 0.84;
/** Phones have fewer particles, so more of them go to the letters. */
export const WORD_SHARE_SMALL = 0.9;
/** "THE" is sampled at this fraction of the main grid step, with dots scaled to match. */
export const FINE_STEP = 0.55;

export const STATUS_LINES = [
  "Opening the archive",
  "Waking the terminal",
  "Tuning resonance",
  "Reading the roster",
  "Lighting the lamp",
] as const;
export const READY_LINE = "The lamp is on";
export const LIVE_READY = "Loaded. Press Enter to open the archive.";

/** Wordmark proportions shared by the canvas mask and the static fallback. */
export const WORDMARK = {
  main: "ASPIRANTS",
  small: "THE",
  weight: 900,
  /** "THE" is lighter so its counters stay open when drawn in particles. */
  smallWeight: 700,
  /** "THE" size relative to "ASPIRANTS". */
  smallRatio: 0.2,
  /** Tracking in em of each line's own size. */
  mainTracking: 0.035,
  smallTracking: 0.8,
  /** Gap between the two lines in em of the main size. */
  gapEm: 0.1,
} as const;

/** Bold condensed stack used when the display font has not loaded. */
export const DISPLAY_FALLBACK =
  '"Big Shoulders Display Variable", "Big Shoulders Display", "Arial Narrow", "Roboto Condensed", Impact, sans-serif';

/** Linear RGB triples (0 to 1) for the particle palette. */
export const COLORS = {
  cyan: [0.31, 0.86, 1],
  ice: [0.86, 0.95, 1],
  gold: [1, 0.77, 0.36],
  amber: [1, 0.58, 0.24],
  violet: [0.64, 0.5, 1],
  field: [0.36, 0.72, 0.92],
} as const satisfies Record<string, readonly [number, number, number]>;
