/**
 * The kinds and the colours each one has by default on the two grounds. Data only (no shader, no
 * three), so a section can read a palette without pulling the renderer in.
 *
 * Daybreak is light and airy: pastel tints, or deep inks at a low alpha for the kinds that are made
 * of thin light (beams, stars, hairlines), so they still read on the paper. Storm is rich: saturated
 * light on near black. `ink` is the highlight colour of a kind (white on storm, a deep blue-grey on
 * daybreak); the last stop of `colors` is its other end of the ramp.
 */

export const BACKDROP_KINDS = [
  "aurora",
  "soft-aurora",
  "beams",
  "particles",
  "dark-veil",
  "silk",
  "threads",
  "plasma",
  "prism",
  "iridescence",
  "liquid-chrome",
  "lightning",
  "orb",
  "galaxy",
  "stars",
  "ripple-grid",
  "squares",
  "dot-grid",
  "grid-distortion",
  "hyperspeed",
  "speed-lines",
  "gradient-blinds",
  "waves",
  "light-rays",
  "floating-lines",
  "pixel-blast",
  "earth",
  "air",
  "water",
  "fire",
  "ink-field",
] as const;

export type BackdropKind = (typeof BACKDROP_KINDS)[number];

export type BackdropTheme = "daybreak" | "storm";

export interface BackdropPalette {
  /** One to four CSS colours: the stops of the kind's ramp. */
  readonly colors: readonly string[];
  /** How strong the kind is on this ground (1 is the kind's own full strength). */
  readonly intensity: number;
  /** The highlight colour. */
  readonly ink: string;
}

const DAY_INK = "#2b3556";
const NIGHT_INK = "#ffffff";

function pal(colors: readonly string[], intensity: number, ink: string): BackdropPalette {
  return { colors, intensity, ink };
}

const DEEP = ["#19b4e6", "#7a63ff", "#f0379f", "#ffb62e"] as const;
const BRAND = ["#5ce1ff", "#b59cff", "#ff6ac8", "#ffcf5c"] as const;

/**
 * The default palette of every kind, by ground. `BACKDROP_PALETTES.aurora.storm.colors` is a good
 * thing to pass to `set` when a section wants the colours of another palette, or a mix of its own.
 *
 * @public
 */
export const BACKDROP_PALETTES: Readonly<
  Record<BackdropKind, Readonly<Record<BackdropTheme, BackdropPalette>>>
> = {
  aurora: {
    daybreak: pal(["#5ce1ff", "#b59cff", "#ff6ac8", "#7ae8c8"], 0.8, DAY_INK),
    storm: pal(["#5ce1ff", "#b59cff", "#ff6ac8", "#7cffc4"], 1.1, NIGHT_INK),
  },
  "soft-aurora": {
    daybreak: pal(["#bfe9ff", "#d9ccff", "#ffd0ee", "#fff1c9"], 0.95, DAY_INK),
    storm: pal(["#2a5bff", "#7a3cff", "#ff3fb0", "#12c6ff"], 0.9, NIGHT_INK),
  },
  beams: {
    daybreak: pal(["#7a63ff", "#19b4e6", "#f0379f", "#ffb62e"], 0.7, DAY_INK),
    storm: pal(BRAND, 1.1, NIGHT_INK),
  },
  particles: {
    daybreak: pal(DEEP, 1, DAY_INK),
    storm: pal(BRAND, 1, NIGHT_INK),
  },
  "dark-veil": {
    daybreak: pal(["#c9d3e6", "#8d9bb8", "#5b6b8c", "#2a3550"], 0.42, DAY_INK),
    storm: pal(["#0b1226", "#1d2e5e", "#4d6bd6", "#a9c4ff"], 1, NIGHT_INK),
  },
  silk: {
    daybreak: pal(["#e8f0ff", "#c9d6ff", "#f3d4ec", "#ffffff"], 1, DAY_INK),
    storm: pal(["#0c1633", "#1c3a8f", "#5c7cff", "#b59cff"], 1, NIGHT_INK),
  },
  threads: {
    daybreak: pal(["#7a63ff", "#19b4e6", "#f0379f", "#7a63ff"], 0.8, DAY_INK),
    storm: pal(["#5ce1ff", "#b59cff", "#ff6ac8", "#5ce1ff"], 1, NIGHT_INK),
  },
  plasma: {
    daybreak: pal(["#b6ecff", "#d8cbff", "#ffc4e8", "#ffe7a8"], 0.8, DAY_INK),
    storm: pal(["#1d3fff", "#8a2bff", "#ff2fa0", "#ff9a2f"], 0.9, NIGHT_INK),
  },
  prism: {
    daybreak: pal(["#ff3d57", "#ffa000", "#19b4e6", "#7a63ff"], 0.75, DAY_INK),
    storm: pal(["#ff5468", "#ffcf5c", "#5ce1ff", "#b59cff"], 1, NIGHT_INK),
  },
  iridescence: {
    daybreak: pal(["#bfe8ff", "#e0c8ff", "#ffc9ec", "#fff0b8"], 0.9, DAY_INK),
    storm: pal(["#4aa8ff", "#b57aff", "#ff6ac8", "#7ad0ff"], 0.85, NIGHT_INK),
  },
  "liquid-chrome": {
    daybreak: pal(["#f4f8ff", "#b9c9e8", "#7b8fc0", "#26325a"], 0.85, DAY_INK),
    storm: pal(["#d8e6ff", "#6d86c9", "#2a3a78", "#05070c"], 0.95, NIGHT_INK),
  },
  lightning: {
    daybreak: pal(["#7a63ff", "#19b4e6", "#19b4e6", "#7a63ff"], 0.9, DAY_INK),
    storm: pal(["#b59cff", "#5ce1ff", "#5ce1ff", "#ffffff"], 1, NIGHT_INK),
  },
  orb: {
    daybreak: pal(BRAND, 0.9, DAY_INK),
    storm: pal(BRAND, 1, NIGHT_INK),
  },
  galaxy: {
    daybreak: pal(["#7a63ff", "#19b4e6", "#f0379f", "#7a63ff"], 0.75, DAY_INK),
    storm: pal(["#ff9ad8", "#b59cff", "#5ce1ff", "#ffffff"], 1, NIGHT_INK),
  },
  stars: {
    daybreak: pal(DEEP, 0.9, DAY_INK),
    storm: pal(["#ffffff", "#b59cff", "#5ce1ff", "#ffcf5c"], 1, NIGHT_INK),
  },
  "ripple-grid": {
    daybreak: pal(["#19b4e6", "#7a63ff", "#f0379f", "#ffb62e"], 0.9, DAY_INK),
    storm: pal(BRAND, 1, NIGHT_INK),
  },
  squares: {
    daybreak: pal(["#19b4e6", "#7a63ff", "#f0379f", "#ffb62e"], 0.9, DAY_INK),
    storm: pal(BRAND, 1, NIGHT_INK),
  },
  "dot-grid": {
    daybreak: pal(["#7a63ff", "#19b4e6", "#f0379f", "#f0379f"], 0.9, DAY_INK),
    storm: pal(["#b59cff", "#5ce1ff", "#ff6ac8", "#ff6ac8"], 1, NIGHT_INK),
  },
  "grid-distortion": {
    daybreak: pal(["#19b4e6", "#7a63ff", "#f0379f", "#ffb62e"], 0.9, DAY_INK),
    storm: pal(BRAND, 1, NIGHT_INK),
  },
  hyperspeed: {
    daybreak: pal(DEEP, 0.85, DAY_INK),
    storm: pal(BRAND, 1, NIGHT_INK),
  },
  "speed-lines": {
    daybreak: pal(DEEP, 0.85, DAY_INK),
    storm: pal(["#5ce1ff", "#ffffff", "#b59cff", "#ffcf5c"], 1, NIGHT_INK),
  },
  "gradient-blinds": {
    daybreak: pal(["#d4ecff", "#e3d6ff", "#ffd6ef", "#fff2cc"], 0.9, DAY_INK),
    storm: pal(["#0e1f4d", "#2a3fa8", "#8a4bff", "#ff6ac8"], 0.95, NIGHT_INK),
  },
  waves: {
    daybreak: pal(["#bfe9ff", "#9fd2ff", "#c9b8ff", "#e8c8ff"], 0.95, DAY_INK),
    storm: pal(["#0b2a6b", "#1a56c8", "#5ce1ff", "#b59cff"], 1, NIGHT_INK),
  },
  "light-rays": {
    daybreak: pal(["#ffd77a", "#ffb0e0", "#a9d6ff", "#ffffff"], 0.75, DAY_INK),
    storm: pal(["#ffcf5c", "#ff9ad8", "#b59cff", "#5ce1ff"], 1, NIGHT_INK),
  },
  "floating-lines": {
    daybreak: pal(["#7a63ff", "#19b4e6", "#f0379f", "#ffb62e"], 0.85, DAY_INK),
    storm: pal(BRAND, 1, NIGHT_INK),
  },
  "pixel-blast": {
    daybreak: pal(["#19b4e6", "#7a63ff", "#f0379f", "#ffb62e"], 0.7, DAY_INK),
    storm: pal(BRAND, 0.9, NIGHT_INK),
  },
  earth: {
    daybreak: pal(["#8a7a64", "#c9b79a", "#e8dcc0", "#d98a2b"], 0.8, DAY_INK),
    storm: pal(["#1d2420", "#4a5a46", "#cfd9a8", "#ffcf5c"], 1, NIGHT_INK),
  },
  air: {
    daybreak: pal(["#19b4e6", "#5ce1ff", "#7a63ff", "#3a4fd6"], 0.85, DAY_INK),
    storm: pal(["#9fe6ff", "#5ce1ff", "#b59cff", "#ffffff"], 1, NIGHT_INK),
  },
  water: {
    daybreak: pal(["#a8e6f2", "#5fc8e6", "#3aa0d8", "#ffffff"], 0.85, DAY_INK),
    storm: pal(["#06314f", "#0d6e9c", "#2bb6e0", "#c9f6ff"], 1, NIGHT_INK),
  },
  fire: {
    daybreak: pal(["#ffcf5c", "#ffa24a", "#ff5468", "#c8203a"], 0.85, DAY_INK),
    storm: pal(["#ffe9a0", "#ffa24a", "#ff5468", "#7a0f2a"], 1, NIGHT_INK),
  },
  // The strip's own: a near black blue ground, deep blue and ice cyan light. No pink (round three).
  "ink-field": {
    daybreak: pal(["#c9d6ee", "#8cc4f0", "#9cc8f5", "#ffffff"], 0.5, DAY_INK),
    storm: pal(["#060b22", "#0f2a78", "#1a6bc8", "#6fd2ff"], 1, "#dff6ff"),
  },
};
