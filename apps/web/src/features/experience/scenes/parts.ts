import type { Mood, PartNumber } from "../contract";

/**
 * Mood tables for the Experience: what each Part and chapter looks and sounds like.
 *
 * This module is imported eagerly by the reader (for `partMood` and `chapterMood`), so it holds
 * plain data only: hex strings, ids and keys. The scene compositions behind each `SceneKey` live
 * in the lazy canvas chunk (`world/presets.ts`).
 *
 * Two moods, two jobs:
 * - `chapterMood` is the TEXT theme of a whole chapter (the reader flips data-theme with it).
 * - `moodAt` is the SCENE mood at a paragraph: it can turn inside a chapter (c11: the lanterns,
 *   then the sky breaks), while the text keeps its chapter theme.
 */

/** Scene compositions the canvas can show. Each key maps to a preset in the lazy chunk. */
export type SceneKey =
  | "gantry-dawn"
  | "cliff-predawn"
  | "gantry-two-stars"
  | "board"
  | "board-tear"
  | "gold-alone"
  | "violet-alone"
  | "two-lights"
  | "chapel-light"
  | "fireworks"
  | "emblem-sync"
  | "lanterns-978"
  | "storm-978"
  | "grey-silence"
  | "sphere-rising"
  | "base-night"
  | "lab-lamp"
  | "will-vortex"
  | "lamp-window"
  | "lamp-window-green"
  | "harbour-fall"
  | "white-silence"
  | "ash"
  | "sphere-cracks"
  | "gantry-square"
  | "ray-of-sun"
  | "crater-garden"
  | "storm-roof"
  | "orb-void"
  | "matrix-lattice"
  | "sleepers"
  | "hall-of-sleepers"
  | "citadel"
  | "vats"
  | "rain-glass"
  | "forty-days"
  | "aperture"
  | "institute-hall"
  | "virtual-battlefield"
  | "breach-alert"
  | "burning-street"
  | "oro-dome"
  | "real-sun"
  | "cyan-bay"
  | "glass-garden"
  | "oro-cleansing"
  | "core"
  | "violet-gate"
  | "command-hold"
  | "breach-sunset"
  | "legion-wedge"
  | "red-plain"
  | "harbour-quay"
  | "silver-line"
  | "roof-night"
  | "garden-morning"
  | "badges"
  | "plane-tree"
  | "attic-rain"
  | "corridor"
  | "void-fall"
  | "ice-plain"
  | "citadel-hall"
  | "citadel-garden"
  | "graduation-day"
  | "sun-out"
  | "rift-opens"
  | "net-unrolls"
  | "aspirant-field"
  | "dead-towers"
  | "emblem-pillar"
  | "rift-flower"
  | "twin-comets"
  | "singularity"
  | "inside-dark"
  | "twin-ribbons"
  | "bell-tower"
  | "lightning-road"
  | "open-space"
  | "stopped-dawn"
  | "lamp-belfry"
  | "lighthouses";

/** Procedural ambient beds (variations of the daybreak pad and the storm pad). */
export type AmbientKey =
  | "dawn-air"
  | "twin-light"
  | "lantern-water"
  | "ash-wind"
  | "void-deep"
  | "machine-hum"
  | "golden-cage"
  | "sunset-fire"
  | "repair-water"
  | "glass-hum"
  | "storm-rift"
  | "dawn-sea";

/** A Part's colours, as sRGB hex. `sky` and `ground` frame the backdrop; accents are lights. */
export interface PartPalette {
  readonly sky: string;
  readonly horizon: string;
  readonly ground: string;
  readonly accent: string;
  readonly accent2: string;
  readonly glow: string;
}

export interface PartScene {
  readonly part: PartNumber;
  readonly title: string;
  /** HUD caption for the Part, for example "PART 01 / THE SECRET BASE". */
  readonly tag: string;
  readonly mood: Mood;
  /** What the scene carries, in one line. */
  readonly intent: string;
  readonly palette: PartPalette;
  /** Public paths of the still art for Calm mode and the WebGL fallback. The first is the main. */
  readonly stills: readonly string[];
  readonly ambient: AmbientKey;
  readonly scene: SceneKey;
}

/** From this paragraph on, the backdrop shows `scene` (and, if given, `mood` and `still`). */
export interface SceneTurn {
  readonly at: string;
  readonly scene: SceneKey;
  readonly mood?: Mood;
  readonly still?: string;
}

export interface ChapterScene {
  readonly part: PartNumber;
  /** Text theme of the whole chapter. */
  readonly mood: Mood;
  /** Scene at the start of the chapter. */
  readonly scene: SceneKey;
  /** Scene mood at the start, when it differs from the text theme. */
  readonly sceneMood?: Mood;
  readonly still?: string;
  readonly ambient?: AmbientKey;
  readonly turns?: readonly SceneTurn[];
}

const STILL = {
  city: "/img/hero-stills/fanny-layla-01.webp",
  laylaSunset: "/img/hero-stills/fanny-layla-02.webp",
  fannyEnders: "/img/hero-stills/fanny-layla-03.webp",
  guinSmoke: "/img/hero-stills/guinevere-vexana-01.webp",
  vexanaEnder: "/img/hero-stills/guinevere-vexana-02.webp",
  guinFlight: "/img/hero-stills/guinevere-vexana-03.webp",
  hands: "/img/hero-stills/guinevere-vexana-04.webp",
  lesleyLedge: "/img/hero-stills/lesley-change-01.webp",
  burningTowers: "/img/hero-stills/lesley-change-02.webp",
  goldEnder: "/img/hero-stills/lesley-change-03.webp",
  rubyScythe: "/img/hero-stills/ruby-angela-01.webp",
  garden: "/img/hero-stills/ruby-angela-02.webp",
  embrace: "/img/hero-stills/ruby-angela-03.webp",
  selenaEnder: "/img/hero-stills/selena-obsidia-01.webp",
  duel: "/img/hero-stills/selena-obsidia-02.webp",
  obsidiaEyes: "/img/hero-stills/selena-obsidia-03.webp",
} as const;

/** Stills with letterbox bars (1280 x 720 frames around a 1280 x 540 picture). */
export const LETTERBOXED_STILLS: ReadonlySet<string> = new Set([
  STILL.city,
  STILL.laylaSunset,
  STILL.fannyEnders,
]);

export const PARTS: Readonly<Record<PartNumber, PartScene>> = {
  1: {
    part: 1,
    title: "The Secret Base",
    tag: "PART 01 / THE SECRET BASE",
    mood: "daybreak",
    intent:
      "A cold clear dawn seen from the gantry: the sun climbs out of the sea over the lake city and the pale hex web of the Defence Sphere.",
    palette: {
      sky: "#cfe2f4",
      horizon: "#ffd8a3",
      ground: "#1c3044",
      accent: "#5ce1ff",
      accent2: "#ffcf5c",
      glow: "#fff2d6",
    },
    stills: [STILL.city],
    ambient: "dawn-air",
    scene: "gantry-dawn",
  },
  2: {
    part: 2,
    title: "Daybreak and Twilight",
    tag: "PART 02 / DAYBREAK AND TWILIGHT",
    mood: "daybreak",
    intent:
      "Two lights, gold and violet, alone at first, then orbiting, then closing until they sing one note.",
    palette: {
      sky: "#2a2142",
      horizon: "#f2b77a",
      ground: "#140f22",
      accent: "#ffcf5c",
      accent2: "#b59cff",
      glow: "#fff0c8",
    },
    stills: [STILL.hands],
    ambient: "twin-light",
    scene: "two-lights",
  },
  3: {
    part: 3,
    title: "The Girl in the Cap",
    tag: "PART 03 / THE GIRL IN THE CAP",
    mood: "storm",
    intent:
      "Year 978: First Light lanterns float on the water like fallen stars, then the sky sings violet and sparks fall.",
    palette: {
      sky: "#1a1530",
      horizon: "#ff9f5a",
      ground: "#0c0a16",
      accent: "#ffae5c",
      accent2: "#8b5cff",
      glow: "#ffe2b8",
    },
    stills: [STILL.goldEnder],
    ambient: "lantern-water",
    scene: "lanterns-978",
  },
  4: {
    part: 4,
    title: "The Night the Base Fell",
    tag: "PART 04 / THE NIGHT THE BASE FELL",
    mood: "storm",
    intent:
      "Dusk over the harbour, a violet flash, white silence, then years of grey ash with one small lamp still lit.",
    palette: {
      sky: "#241a36",
      horizon: "#ff8a4c",
      ground: "#0b0b12",
      accent: "#ffb067",
      accent2: "#9a8cff",
      glow: "#ffe6c4",
    },
    stills: [STILL.lesleyLedge, STILL.burningTowers],
    ambient: "ash-wind",
    scene: "lamp-window",
  },
  5: {
    part: 5,
    title: "The One Who Asked",
    tag: "PART 05 / THE ONE WHO ASKED",
    mood: "storm",
    intent:
      "The Twilight Orb breaks in a void, the Mother Matrix spreads as a vast silver lattice, and one figure among the sleepers does not move.",
    palette: {
      sky: "#07060d",
      horizon: "#3b2a5e",
      ground: "#030306",
      accent: "#c9d3e6",
      accent2: "#ff4a5a",
      glow: "#e8ecff",
    },
    stills: [STILL.obsidiaEyes],
    ambient: "void-deep",
    scene: "orb-void",
  },
  6: {
    part: 6,
    title: "Forty Days",
    tag: "PART 06 / FORTY DAYS",
    mood: "daybreak",
    intent:
      "A countdown of forty ticks, a violet Aperture before sunrise, and the cold green halls of the Institute on the far side.",
    palette: {
      sky: "#101826",
      horizon: "#6a5cff",
      ground: "#060a10",
      accent: "#9b6bff",
      accent2: "#3cffb0",
      glow: "#d9ccff",
    },
    stills: [STILL.laylaSunset, STILL.goldEnder],
    ambient: "machine-hum",
    scene: "forty-days",
  },
  7: {
    part: 7,
    title: "The Golden Cage",
    tag: "PART 07 / THE GOLDEN CAGE",
    mood: "storm",
    intent:
      "Oro under glass: an amber lamp-sun that rises on command against a dull red real dawn that does not pretend.",
    palette: {
      sky: "#3a2a1e",
      horizon: "#ffb347",
      ground: "#140d08",
      accent: "#ffb347",
      accent2: "#b8432f",
      glow: "#ffe0a8",
    },
    stills: [STILL.garden],
    ambient: "golden-cage",
    scene: "oro-dome",
  },
  8: {
    part: 8,
    title: "Beginning!",
    tag: "PART 08 / BEGINNING!",
    mood: "daybreak",
    intent:
      "A gold sunset over a burning city, a silver ship, and a wedge of magenta fire walking into the light.",
    palette: {
      sky: "#1b2a5c",
      horizon: "#ffc35a",
      ground: "#120a10",
      accent: "#ffc35a",
      accent2: "#ff4fb8",
      glow: "#fff0c4",
    },
    stills: [STILL.rubyScythe, STILL.embrace],
    ambient: "sunset-fire",
    scene: "breach-sunset",
  },
  9: {
    part: 9,
    title: "The Newcomers",
    tag: "PART 09 / THE NEWCOMERS",
    mood: "daybreak",
    intent:
      "Quiet repair: clear water in a dry fountain, dawn on the crater garden, gold leaves, badges as stars.",
    palette: {
      sky: "#dbe9f2",
      horizon: "#ffd9a8",
      ground: "#25402f",
      accent: "#7fd6e6",
      accent2: "#ffcf5c",
      glow: "#fff6e0",
    },
    stills: [STILL.garden, STILL.hands],
    ambient: "repair-water",
    scene: "garden-morning",
  },
  10: {
    part: 10,
    title: "The One Who Was Taken",
    tag: "PART 10 / THE ONE WHO WAS TAKEN",
    mood: "storm",
    intent:
      "A long white corridor with cold blue lamps ends in a black gate; beyond it, the void, and far away a gold star that answers.",
    palette: {
      sky: "#06070c",
      horizon: "#2b3a5e",
      ground: "#030407",
      accent: "#6fb6ff",
      accent2: "#ffd36b",
      glow: "#eef4ff",
    },
    stills: [STILL.guinSmoke, STILL.vexanaEnder],
    ambient: "glass-hum",
    scene: "corridor",
  },
  11: {
    part: 11,
    title: "The Storm",
    tag: "PART 11 / THE STORM",
    mood: "storm",
    intent:
      "The sky goes out, a four-pointed crimson rift tears open, the silver net unrolls and a hundred thousand amber eyes wake.",
    palette: {
      sky: "#1a0612",
      horizon: "#ff3b4e",
      ground: "#07030a",
      accent: "#ff3b4e",
      accent2: "#7a3cff",
      glow: "#ffd1c4",
    },
    stills: [STILL.vexanaEnder, STILL.obsidiaEyes],
    ambient: "storm-rift",
    scene: "rift-opens",
  },
  12: {
    part: 12,
    title: "Dawn",
    tag: "PART 12 / DAWN",
    mood: "daybreak",
    intent:
      "The Aspirant Field rings like a bell, twin streams of light rise, and a calm dawn finds the mountains and a hundred and seventeen lighthouses.",
    palette: {
      sky: "#f3d9c4",
      horizon: "#ffcf8a",
      ground: "#2a2a3a",
      accent: "#ffcf5c",
      accent2: "#ff8fb0",
      glow: "#fff4e6",
    },
    stills: [STILL.guinFlight, STILL.hands, STILL.duel],
    ambient: "dawn-sea",
    scene: "lighthouses",
  },
};

/**
 * Every chapter and interlude, in reading order. `mood` is the text theme. Turns use real
 * paragraph ids from `public/data/story` (checked by `parts.test.ts`).
 */
export const CHAPTERS: Readonly<Record<string, ChapterScene>> = {
  // Part One: the gantry at dawn.
  c01: { part: 1, mood: "daybreak", scene: "gantry-dawn" },
  c02: { part: 1, mood: "daybreak", scene: "cliff-predawn" },
  c03: {
    part: 1,
    mood: "daybreak",
    scene: "cliff-predawn",
    turns: [{ at: "c03-p003", scene: "gantry-two-stars" }],
  },
  "i-far-above-1": {
    part: 1,
    mood: "storm",
    scene: "board",
    still: STILL.obsidiaEyes,
    ambient: "void-deep",
  },

  // Part Two: two lights.
  c04: { part: 2, mood: "daybreak", scene: "gold-alone" },
  c05: { part: 2, mood: "storm", scene: "violet-alone" },
  c06: { part: 2, mood: "daybreak", scene: "two-lights" },
  c07: {
    part: 2,
    mood: "daybreak",
    scene: "two-lights",
    turns: [{ at: "c07-p032", scene: "chapel-light" }],
  },
  c08: { part: 2, mood: "daybreak", scene: "two-lights" },
  c09: {
    part: 2,
    mood: "daybreak",
    scene: "two-lights",
    turns: [{ at: "c09-p017", scene: "fireworks" }],
  },
  c10: { part: 2, mood: "daybreak", scene: "emblem-sync" },

  // Part Three: 978. Peace, then the sky breaks.
  c11: {
    part: 3,
    mood: "daybreak",
    scene: "lanterns-978",
    turns: [{ at: "c11-p029", scene: "storm-978", mood: "storm" }],
  },
  c12: {
    part: 3,
    mood: "storm",
    scene: "storm-978",
    turns: [{ at: "c12-p016", scene: "grey-silence" }],
  },
  c13: { part: 3, mood: "storm", scene: "sphere-rising" },
  c14: { part: 3, mood: "storm", scene: "cliff-predawn", sceneMood: "storm" },
  c15: { part: 3, mood: "daybreak", scene: "base-night", still: STILL.city },
  c16: { part: 3, mood: "daybreak", scene: "base-night", still: STILL.city },
  c17: {
    part: 3,
    mood: "daybreak",
    scene: "lab-lamp",
    still: STILL.city,
    turns: [{ at: "c17-p031", scene: "will-vortex", mood: "storm" }],
  },

  // Part Four: the night the Base fell.
  c18: {
    part: 4,
    mood: "storm",
    scene: "lamp-window",
    turns: [
      { at: "c18-p013", scene: "cliff-predawn" },
      { at: "c18-p020", scene: "harbour-fall" },
      { at: "c18-p033", scene: "white-silence" },
    ],
  },
  c19: { part: 4, mood: "storm", scene: "ash" },
  c20: {
    part: 4,
    mood: "storm",
    scene: "lamp-window",
    turns: [
      { at: "c20-p008", scene: "lab-lamp" },
      { at: "c20-p019", scene: "lamp-window" },
      { at: "c20-p022", scene: "ash" },
    ],
  },
  c21: {
    part: 4,
    mood: "storm",
    scene: "sphere-cracks",
    still: STILL.burningTowers,
    turns: [
      { at: "c21-p044", scene: "gantry-square", mood: "daybreak" },
      { at: "c21-p049", scene: "ray-of-sun", mood: "daybreak" },
    ],
  },
  c22: { part: 4, mood: "daybreak", scene: "crater-garden", ambient: "repair-water" },

  // Part Five: the one who asked.
  c23: {
    part: 5,
    mood: "storm",
    scene: "storm-roof",
    turns: [{ at: "c23-p060", scene: "board" }],
  },
  c24: {
    part: 5,
    mood: "storm",
    scene: "orb-void",
    turns: [
      { at: "c24-p008", scene: "matrix-lattice" },
      { at: "c24-p017", scene: "sleepers" },
    ],
  },
  c25: {
    part: 5,
    mood: "storm",
    scene: "sleepers",
    turns: [{ at: "c25-p022", scene: "citadel" }],
  },
  c26: { part: 5, mood: "storm", scene: "vats" },
  c27: {
    part: 5,
    mood: "storm",
    scene: "rain-glass",
    turns: [
      { at: "c27-p022", scene: "board" },
      { at: "c27-p029", scene: "lamp-window" },
    ],
  },

  // Part Six: forty days.
  c28: {
    part: 6,
    mood: "daybreak",
    scene: "forty-days",
    turns: [{ at: "c28-p026", scene: "aperture" }],
  },
  c29: {
    part: 6,
    mood: "storm",
    scene: "institute-hall",
    still: STILL.goldEnder,
  },
  c30: { part: 6, mood: "daybreak", scene: "virtual-battlefield" },
  c31: { part: 6, mood: "storm", scene: "breach-alert" },
  c32: {
    part: 6,
    mood: "storm",
    scene: "burning-street",
    turns: [{ at: "c32-p033", scene: "breach-sunset" }],
  },

  // Part Seven: the golden cage.
  c33: { part: 7, mood: "storm", scene: "oro-dome" },
  c34: { part: 7, mood: "storm", scene: "oro-dome" },
  c35: {
    part: 7,
    mood: "daybreak",
    scene: "cyan-bay",
    turns: [
      { at: "c35-p033", scene: "glass-garden" },
      { at: "c35-p037", scene: "real-sun" },
    ],
  },
  c36: {
    part: 7,
    mood: "storm",
    scene: "oro-cleansing",
    turns: [{ at: "c36-p011", scene: "red-plain" }],
  },
  c37: { part: 7, mood: "storm", scene: "core" },
  c38: {
    part: 7,
    mood: "storm",
    scene: "oro-dome",
    turns: [
      { at: "c38-p019", scene: "violet-gate" },
      { at: "c38-p024", scene: "command-hold" },
    ],
  },

  // Part Eight: beginning.
  c39: {
    part: 8,
    mood: "storm",
    scene: "breach-sunset",
    sceneMood: "daybreak",
    turns: [{ at: "c39-p039", scene: "legion-wedge", mood: "storm" }],
  },
  c40: {
    part: 8,
    mood: "storm",
    scene: "breach-sunset",
    still: STILL.fannyEnders,
    turns: [
      { at: "c40-p020", scene: "red-plain" },
      { at: "c40-p023", scene: "legion-wedge", still: STILL.embrace },
      { at: "c40-p033", scene: "red-plain" },
    ],
  },
  c41: { part: 8, mood: "daybreak", scene: "harbour-quay", still: STILL.hands },
  c42: {
    part: 8,
    mood: "daybreak",
    scene: "legion-wedge",
    sceneMood: "storm",
    still: STILL.embrace,
    turns: [
      { at: "c42-p019", scene: "silver-line", mood: "daybreak" },
      { at: "c42-p057", scene: "roof-night", mood: "daybreak" },
    ],
  },

  // Part Nine: the newcomers.
  "i-far-above-2": {
    part: 9,
    mood: "storm",
    scene: "board-tear",
    still: STILL.obsidiaEyes,
    ambient: "void-deep",
  },
  c43: { part: 9, mood: "daybreak", scene: "garden-morning" },
  c44: { part: 9, mood: "daybreak", scene: "badges", still: STILL.hands },
  c45: { part: 9, mood: "daybreak", scene: "plane-tree", still: STILL.hands },
  c46: { part: 9, mood: "daybreak", scene: "gantry-dawn", still: STILL.city },

  // Part Ten: the one who was taken.
  c47: {
    part: 10,
    mood: "storm",
    scene: "attic-rain",
    turns: [{ at: "c47-p012", scene: "corridor" }],
  },
  c48: {
    part: 10,
    mood: "storm",
    scene: "void-fall",
    still: STILL.vexanaEnder,
    turns: [
      { at: "c48-p011", scene: "will-vortex" },
      { at: "c48-p022", scene: "ash" },
      { at: "c48-p032", scene: "core" },
      { at: "c48-p042", scene: "will-vortex" },
    ],
  },
  c49: {
    part: 10,
    mood: "daybreak",
    scene: "attic-rain",
    sceneMood: "storm",
    turns: [
      { at: "c49-p024", scene: "ice-plain", mood: "daybreak" },
      { at: "c49-p037", scene: "attic-rain", mood: "daybreak" },
    ],
  },
  c50: {
    part: 10,
    mood: "storm",
    scene: "citadel-hall",
    still: STILL.vexanaEnder,
    turns: [
      { at: "c50-p010", scene: "citadel-garden" },
      { at: "c50-p019", scene: "attic-rain" },
      { at: "c50-p031", scene: "lab-lamp" },
      { at: "c50-p050", scene: "lamp-window-green" },
    ],
  },

  // Part Eleven: the storm.
  c51: {
    part: 11,
    mood: "storm",
    scene: "matrix-lattice",
    still: STILL.obsidiaEyes,
    turns: [
      { at: "c51-p019", scene: "citadel-garden" },
      { at: "c51-p040", scene: "hall-of-sleepers" },
      { at: "c51-p047", scene: "citadel" },
    ],
  },
  c52: {
    part: 11,
    mood: "daybreak",
    scene: "graduation-day",
    still: STILL.city,
    ambient: "dawn-air",
    turns: [
      { at: "c52-p016", scene: "lamp-window" },
      { at: "c52-p037", scene: "lab-lamp" },
      { at: "c52-p048", scene: "graduation-day" },
      { at: "c52-p059", scene: "sun-out", mood: "storm", still: STILL.selenaEnder },
      { at: "c52-p066", scene: "rift-opens", mood: "storm", still: STILL.selenaEnder },
    ],
  },
  c53: {
    part: 11,
    mood: "storm",
    scene: "rift-opens",
    turns: [{ at: "c53-p029", scene: "net-unrolls" }],
  },

  // Part Twelve: dawn.
  c54: {
    part: 12,
    mood: "daybreak",
    scene: "net-unrolls",
    sceneMood: "storm",
    turns: [{ at: "c54-p027", scene: "aspirant-field", mood: "daybreak" }],
  },
  c55: {
    part: 12,
    mood: "storm",
    scene: "dead-towers",
    still: STILL.guinFlight,
    turns: [{ at: "c55-p027", scene: "emblem-pillar" }],
  },
  c56: {
    part: 12,
    mood: "storm",
    scene: "rift-flower",
    still: STILL.vexanaEnder,
    turns: [{ at: "c56-p018", scene: "twin-comets" }],
  },
  c57: {
    part: 12,
    mood: "daybreak",
    scene: "singularity",
    sceneMood: "storm",
    still: STILL.hands,
    turns: [
      { at: "c57-p017", scene: "inside-dark", mood: "daybreak" },
      { at: "c57-p030", scene: "twin-ribbons", mood: "daybreak" },
    ],
  },
  c58: {
    part: 12,
    mood: "storm",
    scene: "bell-tower",
    still: STILL.selenaEnder,
    turns: [{ at: "c58-p036", scene: "lightning-road" }],
  },
  c59: {
    part: 12,
    mood: "storm",
    scene: "citadel-hall",
    still: STILL.duel,
    turns: [{ at: "c59-p033", scene: "open-space" }],
  },
  c60: {
    part: 12,
    mood: "daybreak",
    scene: "stopped-dawn",
    turns: [
      { at: "c60-p021", scene: "gantry-dawn" },
      { at: "c60-p038", scene: "lamp-belfry" },
      { at: "c60-p048", scene: "lighthouses" },
    ],
  },
};

/** The Part's own mood (the default text theme of its chapters). */
export function partMood(part: PartNumber): Mood {
  return PARTS[part].mood;
}

/** Text theme of a chapter. A chapter may differ from its Part (for example a flashback). */
export function chapterMood(chapterId: string, part: PartNumber): Mood {
  return CHAPTERS[chapterId]?.mood ?? partMood(part);
}

/** Paragraph number inside its chapter (`c11-p029` gives 29), or -1. */
export function paragraphIndex(paragraphId: string | null | undefined): number {
  const match = paragraphId ? /-p(\d+)$/.exec(paragraphId) : null;
  return match ? Number(match[1]) : -1;
}

export interface SceneState {
  readonly scene: SceneKey;
  readonly mood: Mood;
  readonly still: string;
  readonly ambient: AmbientKey;
}

/**
 * What the backdrop shows at a paragraph: the chapter's scene, advanced by every turn at or
 * before the paragraph. Without a paragraph, the chapter start.
 */
export function sceneAt(
  chapterId: string | null,
  paragraphId: string | null,
  part: PartNumber,
): SceneState {
  const partScene = PARTS[part];
  const chapter = chapterId ? CHAPTERS[chapterId] : undefined;
  if (!chapter) {
    return {
      scene: partScene.scene,
      mood: partScene.mood,
      still: partScene.stills[0] ?? STILL.city,
      ambient: partScene.ambient,
    };
  }
  let scene = chapter.scene;
  let mood = chapter.sceneMood ?? chapter.mood;
  let still = chapter.still ?? partScene.stills[0] ?? STILL.city;
  const index =
    paragraphId && chapterId && paragraphId.startsWith(`${chapterId}-`)
      ? paragraphIndex(paragraphId)
      : -1;
  for (const turn of chapter.turns ?? []) {
    if (paragraphIndex(turn.at) > index) break;
    scene = turn.scene;
    if (turn.mood) mood = turn.mood;
    if (turn.still) still = turn.still;
  }
  return { scene, mood, still, ambient: chapter.ambient ?? partScene.ambient };
}

/** Scene mood at a paragraph (may turn inside a chapter; the text theme does not). */
export function moodAt(
  chapterId: string | null,
  paragraphId: string | null,
  part: PartNumber,
): Mood {
  return sceneAt(chapterId, paragraphId, part).mood;
}
