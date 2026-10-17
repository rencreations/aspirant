import type { SceneKey } from "../parts";
import type { CityParams, LatticeParams, ParticleParams, Preset } from "./types";

/**
 * Every scene composition, keyed by `SceneKey`. Data only: the layers in `World` read it.
 * Each preset starts with a one-line intent: what the picture carries in the story.
 * Storm scenes stay dark; daybreak scenes stay high key, so text keeps its contrast budget.
 */

const motes = (
  color: string,
  color2?: string,
  extra: Partial<ParticleParams> = {},
): ParticleParams => ({
  mode: "motes",
  color,
  ...(color2 ? { color2 } : {}),
  area: [14, -2, 6, 4, -24],
  ...extra,
});

const terrinia = (extra: Partial<CityParams> = {}): CityParams => ({
  color: "#0d1220",
  fog: "#2a3550",
  windows: "#ffcf8a",
  lit: 0.45,
  ...extra,
});

const NET: LatticeParams = {
  mode: "net",
  color: "#cfd8e6",
  color2: "#ffffff",
  center: [0, 0, -34],
  opacity: 0.9,
};

export const PRESETS: Record<SceneKey, Preset> = {
  // Part One --------------------------------------------------------------------------------
  "gantry-dawn": {
    intent:
      "Seventy metres up the tower at dawn: the sun climbs out of the sea, cold clear sky, the lake city under the pale hex web.",
    camera: { lookY: -0.45 },
    fog: { color: "#c3d5e6", near: 18, far: 95 },
    sky: {
      top: "#4f7fb5",
      mid: "#cfe1f1",
      bottom: "#203448",
      band: "#ffd29a",
      bandStrength: 0.85,
      sun: { x: 0.22, y: -0.012, size: 0.03, color: "#ffe0aa", glow: 1.3, rise: 0.12 },
      clouds: { amount: 0.22, color: "#b9c9da", light: "#fff1dc", speed: 0.6, height: 0.22 },
      water: { color: "#29455f", glitter: 1.3 },
    },
    city: terrinia({
      color: "#36506c",
      fog: "#c3d5e6",
      windows: "#ffd8a0",
      lit: 0.3,
      gantry: true,
    }),
    dome: { color: "#a6ecff", opacity: 0.55, cells: 16 },
    particles: [motes("#fff1d6", "#bff3ff", { count: 500 })],
  },
  "cliff-predawn": {
    intent:
      "An hour before dawn on the Cadet Corps cliffs: the sea, the last stars, the city's lights across the harbour under its web.",
    camera: { lookY: -0.25 },
    fog: { color: "#1c2a44", near: 15, far: 90 },
    sky: {
      top: "#0b1630",
      mid: "#34507a",
      bottom: "#0a1220",
      band: "#e8a77a",
      bandStrength: 0.55,
      stars: 0.6,
      clouds: { amount: 0.18, color: "#24365a", light: "#e8b48a", speed: 0.5, height: 0.2 },
      water: { color: "#0d192b", glitter: 0.4 },
    },
    city: terrinia({ color: "#0a1224", fog: "#1c2a44", lit: 0.55, depth: 52, height: 0.8 }),
    dome: { color: "#7fdcff", opacity: 0.28, center: [0, -2.2, -58], cells: 16 },
    shapes: [{ kind: "terrain", color: "#0a0e18", color3: "#05070d", c: 1 }],
    particles: [motes("#bfe6ff", undefined, { count: 300 })],
  },
  "gantry-two-stars": {
    intent:
      "The gantry at sunrise with two of them up there: two bright stars still in one sky, two metres apart.",
    camera: { lookY: -0.45 },
    fog: { color: "#c9d6e6", near: 18, far: 95 },
    sky: {
      top: "#5a86b8",
      mid: "#d6e4f2",
      bottom: "#203448",
      band: "#ffcf96",
      bandStrength: 0.9,
      sun: { x: -0.18, y: -0.02, size: 0.03, color: "#ffd9a0", glow: 1.2, rise: 0.1 },
      clouds: { amount: 0.18, color: "#c2cfde", light: "#fff1dc", speed: 0.5, height: 0.24 },
      water: { color: "#2a4560", glitter: 1.2 },
    },
    city: terrinia({ color: "#3a536e", fog: "#c9d6e6", lit: 0.2, gantry: true }),
    dome: { color: "#a6ecff", opacity: 0.45, cells: 16 },
    lights: {
      lights: [
        {
          color: "#ffe2a0",
          size: 1.6,
          pos: [-5.4, 3.4, -22],
          kind: "star",
          intensity: 1.2,
          pulse: 0.3,
        },
        {
          color: "#c6f4ff",
          size: 1.4,
          pos: [-3.2, 3.9, -22],
          kind: "star",
          intensity: 1.1,
          pulse: 0.37,
        },
      ],
    },
    particles: [motes("#fff1d6", "#bff3ff", { count: 400 })],
  },
  board: {
    intent:
      "Far above, a woman alone in the dark watches through a thin eye of storm; one white pawn stands a little ahead.",
    camera: { y: 0.8, lookY: -1.4 },
    fog: { color: "#07050d", near: 6, far: 26 },
    sky: {
      top: "#040309",
      mid: "#120b20",
      bottom: "#030207",
      band: "#2c1648",
      bandStrength: 0.5,
      vortex: { amount: 0.45, color: "#7a5ad0", color2: "#1c1236" },
      stars: 0.25,
    },
    shapes: [{ kind: "board", color: "#08070e", color2: "#17122a", color3: "#3d2f66" }],
    lights: {
      lights: [
        {
          color: "#f4efe6",
          size: 1.1,
          pos: [0.56, -0.9, -1.85],
          kind: "orb",
          intensity: 0.7,
          pulse: 0.15,
        },
      ],
    },
    particles: [{ mode: "stars", color: "#c9b6ff", count: 900, area: [24, -4, 12, -10, -60] }],
  },
  "board-tear": {
    intent:
      "After Oro: a single tear falls on a dark square of the board. She did not know she could do that.",
    camera: { y: 0.8, lookY: -1.4 },
    fog: { color: "#07050d", near: 6, far: 26 },
    sky: {
      top: "#040309",
      mid: "#0f0a1c",
      bottom: "#030207",
      band: "#24123c",
      bandStrength: 0.45,
      vortex: { amount: 0.3, color: "#6a4ab8", color2: "#160e2a" },
      stars: 0.2,
    },
    shapes: [{ kind: "board", color: "#08070e", color2: "#17122a", color3: "#2e2450" }],
    lights: {
      lights: [
        { color: "#f4efe6", size: 0.9, pos: [0.56, -0.9, -1.85], kind: "orb", intensity: 0.5 },
        {
          color: "#cfe8ff",
          size: 0.5,
          pos: [-0.6, -1.62, -2.4],
          kind: "orb",
          intensity: 1.4,
          pulse: 0.25,
        },
      ],
    },
    particles: [{ mode: "stars", color: "#c9b6ff", count: 700, area: [24, -4, 12, -10, -60] }],
  },

  // Part Two --------------------------------------------------------------------------------
  "gold-alone": {
    intent:
      "Guinevere alone: one gold light over the sea-wall at dusk, so bright that you will have to look.",
    camera: { lookY: -0.3 },
    fog: { color: "#e2b98e", near: 18, far: 90 },
    sky: {
      top: "#3d4272",
      mid: "#e8b88a",
      bottom: "#2a2238",
      band: "#ffd08a",
      bandStrength: 0.95,
      sun: { x: -0.32, y: 0.015, size: 0.034, color: "#ffc670", glow: 1.4 },
      clouds: { amount: 0.3, color: "#a07a8a", light: "#ffd9a8", speed: 0.4, height: 0.2 },
      water: { color: "#352f4c", glitter: 1.2 },
    },
    city: terrinia({ color: "#2a2540", fog: "#e2b98e", windows: "#ffd27a", lit: 0.75 }),
    lights: {
      lights: [
        {
          color: "#ffd36b",
          size: 3.2,
          pos: [3.4, 0.9, -7],
          kind: "orb",
          intensity: 1.3,
          pulse: 0.2,
        },
      ],
    },
    particles: [motes("#ffe6a8")],
  },
  "violet-alone": {
    intent:
      "Vexana alone: a violet light in the rain at dusk, a hum like a wet finger on glass, a green lamp in a cupboard.",
    camera: { lookY: -0.2 },
    fog: { color: "#140f24", near: 10, far: 70 },
    sky: {
      top: "#0a0918",
      mid: "#2a2046",
      bottom: "#07060e",
      band: "#6a4a9a",
      bandStrength: 0.6,
      clouds: {
        amount: 0.6,
        color: "#1a1430",
        light: "#8a74c0",
        speed: 0.6,
        storm: 0.4,
        height: 0.2,
      },
    },
    city: terrinia({ color: "#07060e", fog: "#140f24", windows: "#c9b6ff", lit: 0.12 }),
    lights: {
      lights: [
        {
          color: "#b59cff",
          size: 3,
          pos: [-3.4, 0.7, -7],
          kind: "orb",
          intensity: 1.2,
          pulse: 0.18,
        },
        { color: "#9fe08a", size: 0.9, pos: [3.2, -1.3, -3.5], kind: "lamp", intensity: 0.9 },
      ],
    },
    particles: [
      { mode: "rain", color: "#9a8cc0", tilt: 0.12, opacity: 0.35, area: [14, -3, 8, 4, -16] },
    ],
  },
  "two-lights": {
    intent:
      "Daybreak and twilight: a gold light and a violet light orbit each other, closer with every chapter of the Part.",
    camera: { lookY: -0.3 },
    fog: { color: "#3a2e4e", near: 14, far: 80 },
    sky: {
      top: "#1c1b3c",
      mid: "#8a6a9c",
      bottom: "#141026",
      band: "#f2b77a",
      bandStrength: 0.8,
      clouds: { amount: 0.25, color: "#4a3a62", light: "#f2c08a", speed: 0.4, height: 0.22 },
      water: { color: "#1c1830", glitter: 0.9 },
    },
    city: terrinia({ color: "#120f20", fog: "#3a2e4e", lit: 0.4 }),
    lights: {
      lights: [
        { color: "#ffd36b", size: 2.4, kind: "orb", intensity: 1.2, pulse: 0.2 },
        { color: "#b59cff", size: 2.4, kind: "orb", intensity: 1.2, pulse: 0.2 },
      ],
      orbit: { center: [0, 1.2, -9], from: 9, to: 1.4, drive: "part", speed: 0.22, sync: true },
    },
    particles: [motes("#ffe2a8", "#c9b6ff")],
  },
  "chapel-light": {
    intent:
      "The chapel: small blue four-pointed stars on the beams, coloured morning light, silver and gold threads winding into one rope.",
    camera: { lookY: 0.2 },
    sky: {
      top: "#2a2c52",
      mid: "#bcb0d4",
      bottom: "#1a1830",
      band: "#ffe2b0",
      bandStrength: 0.7,
      sun2: { x: 0.0, y: 0.32, size: 0.05, color: "#ffe9c0", glow: 1.6 },
    },
    lattice: [
      { mode: "threads", color: "#ffd27a", color2: "#eef2ff", center: [0, -0.6, -9], scale: 0.7 },
    ],
    lights: {
      lights: Array.from({ length: 11 }, (_, i) => ({
        color: "#9cc4ff",
        size: 0.55,
        pos: [(i - 5) * 1.6, 3.2 + Math.sin(i * 1.9) * 0.5, -10 - (i % 3)] as [
          number,
          number,
          number,
        ],
        kind: "star" as const,
        intensity: 0.9,
        pulse: 0.2 + (i % 4) * 0.05,
      })),
    },
    particles: [motes("#fff0d0", "#c9dcff", { count: 600 })],
  },
  fireworks: {
    intent:
      "The Summer Fete on the sea-wall: gold and crimson fireworks, gone so quickly because they are so bright.",
    camera: { lookY: 0.4 },
    fog: { color: "#0b0f22", near: 14, far: 70 },
    sky: {
      top: "#05081a",
      mid: "#1a1f46",
      bottom: "#05060e",
      band: "#4a3a6a",
      bandStrength: 0.5,
      stars: 0.35,
      water: { color: "#090c1e", glitter: 0.8 },
    },
    city: terrinia({ color: "#05060e", fog: "#0b0f22", lit: 0.6 }),
    lights: {
      lights: [
        { color: "#ffd36b", size: 0.7, pos: [-0.5, -1.7, -4], kind: "orb", intensity: 0.9 },
        { color: "#b59cff", size: 0.7, pos: [0.2, -1.7, -4], kind: "orb", intensity: 0.9 },
      ],
    },
    particles: [
      { mode: "fireworks", color: "#ffd26a", color2: "#ff4a5a", area: [12, -1, 9, -20, -20] },
      { mode: "embers", color: "#ffb06a", count: 260, area: [12, -2, 6, -6, -20] },
    ],
  },
  "emblem-sync": {
    intent:
      "The roof of the east wing: two gold stars made by hand drift together and sing one note, petals over the railing.",
    camera: { lookY: -0.3 },
    fog: { color: "#e6d6c6", near: 18, far: 90 },
    sky: {
      top: "#7aa4d4",
      mid: "#f1e4d6",
      bottom: "#2a3446",
      band: "#ffd7a0",
      bandStrength: 0.8,
      sun: { x: 0.34, y: 0.16, size: 0.03, color: "#fff0cc", glow: 1.1 },
      clouds: { amount: 0.18, color: "#d9d6e2", light: "#fff6e6", speed: 0.4, height: 0.24 },
    },
    city: terrinia({ color: "#4a5872", fog: "#e6d6c6", lit: 0.15 }),
    dome: { color: "#bff3ff", opacity: 0.32, cells: 16 },
    lights: {
      lights: [
        { color: "#ffd96b", size: 1.6, kind: "star", intensity: 1.3, pulse: 0.5 },
        { color: "#ffe8b0", size: 1.6, kind: "star", intensity: 1.3, pulse: 0.5 },
      ],
      orbit: {
        center: [0, 1.4, -6],
        from: 3.4,
        to: 0.35,
        drive: "chapter",
        speed: 0.15,
        sync: true,
      },
    },
    particles: [{ mode: "petals", color: "#ffb7c9", color2: "#ffd6e0", area: [10, -2, 6, 4, -10] }],
  },

  // Part Three ------------------------------------------------------------------------------
  "lanterns-978": {
    intent:
      "First Light in 978: paper lanterns on the water at dusk, like a field of fallen stars, before anyone feared the sky.",
    camera: { lookY: -0.9 },
    fog: { color: "#3a2c4e", near: 14, far: 80 },
    sky: {
      top: "#1b2247",
      mid: "#7d5a86",
      bottom: "#120f20",
      band: "#ff9f6a",
      bandStrength: 0.9,
      sun: { x: -0.3, y: -0.03, size: 0.04, color: "#ff8a4a", glow: 1.4 },
      clouds: { amount: 0.3, color: "#3a2c4e", light: "#ffb07a", speed: 0.4, height: 0.16 },
      stars: 0.35,
      water: { color: "#151a33", glitter: 0.8, waves: 0.8 },
    },
    city: terrinia({ color: "#1a1428", fog: "#3a2c4e", lit: 0.55 }),
    particles: [
      { mode: "lanterns", color: "#ffb35c", color2: "#ff7a4a", area: [16, -2.2, 0, 5, -60] },
      motes("#ffd2a0", undefined, { count: 260 }),
    ],
  },
  "storm-978": {
    intent:
      "The ninth of September, 978: the sky sings, a cold violet light spreads under the clouds, something huge falls with a thousand sparks.",
    camera: { lookY: 0.6 },
    fog: { color: "#140c24", near: 12, far: 70 },
    sky: {
      top: "#07050f",
      mid: "#231244",
      bottom: "#05040a",
      band: "#6b3cff",
      bandStrength: 0.7,
      clouds: {
        amount: 0.85,
        color: "#0e0a1c",
        light: "#a58bff",
        under: "#6a3dff",
        speed: 1.6,
        storm: 1,
        height: 0.24,
      },
      flash: 0.3,
    },
    city: terrinia({ color: "#06050c", fog: "#140c24", lit: 0.08, height: 0.6 }),
    particles: [
      {
        mode: "sparks",
        color: "#d0c0ff",
        color2: "#ff9a5a",
        tilt: 0.18,
        area: [22, -2, 16, -6, -50],
      },
    ],
  },
  "grey-silence": {
    intent:
      "The morning after: grey, quiet ruins, a scrap of a plum-coloured lantern blowing across the rubble.",
    camera: { lookY: -0.2 },
    fog: { color: "#2c2e35", near: 8, far: 60 },
    sky: {
      top: "#1a1c22",
      mid: "#34363e",
      bottom: "#101116",
      band: "#4c4c54",
      bandStrength: 0.6,
      clouds: { amount: 0.55, color: "#2a2c33", light: "#5a5c64", speed: 0.2, height: 0.16 },
    },
    city: terrinia({
      color: "#0f1015",
      fog: "#2c2e35",
      lit: 0.0,
      ruin: 0.95,
      height: 0.5,
      depth: 28,
    }),
    lights: {
      lights: [
        {
          color: "#b0507a",
          size: 0.45,
          pos: [-1.6, -2.0, -4],
          kind: "orb",
          intensity: 0.8,
          pulse: 0.1,
        },
      ],
    },
    particles: [{ mode: "ash", color: "#8a8a92", color2: "#5a5a62", area: [12, -3, 7, 4, -18] }],
  },
  "sphere-rising": {
    intent:
      "The survivors gather in the old quarter and raise the Defence Sphere, a lattice of glowing hexagons, weak at first.",
    camera: { lookY: -0.4 },
    fog: { color: "#14223a", near: 14, far: 90 },
    sky: {
      top: "#060a16",
      mid: "#1a2a44",
      bottom: "#05070d",
      band: "#2f4f7a",
      bandStrength: 0.6,
      stars: 0.45,
    },
    city: terrinia({ color: "#060a14", fog: "#14223a", lit: 0.5 }),
    dome: { color: "#7fdcff", opacity: 0.75, build: "chapter", cells: 16 },
    particles: [motes("#9fe8ff", undefined, { count: 400 })],
  },
  "base-night": {
    intent:
      "Selrick Base by the harbour at blue hour: tea at half past nine, and a crescent moon of a hover-board over the lights.",
    camera: { lookY: -0.35 },
    fog: { color: "#7d93b8", near: 16, far: 90 },
    sky: {
      top: "#2a3f6e",
      mid: "#8fa8cd",
      bottom: "#141c30",
      band: "#ffc98a",
      bandStrength: 0.75,
      sun2: { x: 0.32, y: 0.3, size: 0.012, color: "#eef2ff", glow: 0.8 },
      water: { color: "#1c2844", glitter: 0.6 },
    },
    city: terrinia({
      color: "#1a2440",
      fog: "#7d93b8",
      lit: 0.8,
      tower: { x: -6, height: 5, lamp: "#ffd8a0", window: 0.6 },
    }),
    dome: { color: "#bff3ff", opacity: 0.35, cells: 16 },
    lights: {
      lights: [
        {
          color: "#7fffe0",
          size: 1.2,
          pos: [3.6, 2.4, -12],
          kind: "flare",
          intensity: 1.1,
          pulse: 0.4,
        },
      ],
    },
    particles: [motes("#ffe6c0", "#bff3ff", { count: 400 })],
  },
  "lab-lamp": {
    intent:
      "A dark lab and one lamp on a white cloth: a small blue eye, a bad cake, a person building a way back.",
    camera: { lookY: 0 },
    sky: { top: "#06070b", mid: "#101219", bottom: "#05060a", band: "#1c2030", bandStrength: 0.5 },
    lights: {
      lights: [
        {
          color: "#ffd8a0",
          size: 4.2,
          pos: [-2.6, 0.6, -4],
          kind: "lamp",
          intensity: 1.0,
          pulse: 0.08,
        },
        {
          color: "#9fd0ff",
          size: 0.8,
          pos: [-2.0, -0.7, -3.2],
          kind: "orb",
          intensity: 1.2,
          pulse: 0.3,
        },
      ],
    },
    particles: [motes("#ffe2b8", undefined, { count: 300, area: [5, -2, 3, 1, -8] })],
  },
  "will-vortex": {
    intent:
      "The Will of the Planet: a vast vortex the colour of twilight with a thousand dim stars in its heart. It is listening.",
    camera: { lookY: 0.1 },
    sky: {
      top: "#020207",
      mid: "#0a0918",
      bottom: "#020206",
      band: "#1c1638",
      bandStrength: 0.4,
      vortex: { amount: 1, color: "#8b6bd8", color2: "#22306a" },
      stars: 0.35,
    },
    lattice: [
      { mode: "web", color: "#aab8d6", color2: "#ffffff", center: [0, 0, -40], opacity: 0.35 },
    ],
    particles: [{ mode: "stars", color: "#d8ccff", count: 1200, area: [30, -10, 14, -10, -70] }],
  },

  // Part Four -------------------------------------------------------------------------------
  "lamp-window": {
    intent:
      "Someone is always waiting: a dark tower, rain, and one lamp lit in a window on the third floor.",
    camera: { lookY: -0.1 },
    fog: { color: "#191a28", near: 10, far: 70 },
    sky: {
      top: "#090b15",
      mid: "#222437",
      bottom: "#06070c",
      band: "#4a3f5a",
      bandStrength: 0.55,
      clouds: { amount: 0.45, color: "#1a1b2a", light: "#5a5070", speed: 0.4, height: 0.2 },
    },
    city: terrinia({
      color: "#07080f",
      fog: "#191a28",
      lit: 0.1,
      tower: { x: 2.4, height: 7, lamp: "#ffcf86", window: 0.36 },
    }),
    particles: [
      { mode: "rain", color: "#8a90b0", tilt: 0.08, opacity: 0.3, area: [12, -3, 8, 4, -14] },
    ],
  },
  "lamp-window-green": {
    intent:
      "A grey morning in the rain: far off, a white tower whose green lamp looks like a candle in a window.",
    camera: { lookY: -0.15 },
    fog: { color: "#3d4656", near: 10, far: 70 },
    sky: {
      top: "#1f2531",
      mid: "#4a5464",
      bottom: "#11141a",
      band: "#6a7686",
      bandStrength: 0.5,
      clouds: { amount: 0.6, color: "#343c4a", light: "#7a8696", speed: 0.3, height: 0.18 },
    },
    city: terrinia({
      color: "#11141b",
      fog: "#3d4656",
      lit: 0.05,
      tower: { x: -3, height: 7.5, lamp: "#7dffb0", window: 0.92 },
    }),
    particles: [
      { mode: "rain", color: "#9aa4b4", tilt: 0.1, opacity: 0.3, area: [12, -3, 8, 4, -14] },
    ],
  },
  "harbour-fall": {
    intent:
      "Dusk over the harbour: bruise-violet sky, a huge dark ship, Enders falling like rain and a violet flash where the Base stood.",
    camera: { lookY: 0.2 },
    fog: { color: "#2a1630", near: 12, far: 80 },
    sky: {
      top: "#120a22",
      mid: "#5a2a5e",
      bottom: "#07050c",
      band: "#ff7a3c",
      bandStrength: 0.75,
      clouds: {
        amount: 0.75,
        color: "#1c0f26",
        light: "#ff9a6a",
        under: "#8a4dff",
        speed: 1.2,
        storm: 0.8,
        height: 0.22,
      },
      flash: 0.25,
      water: { color: "#120c1c", glitter: 0.7 },
    },
    city: terrinia({
      color: "#08060c",
      fog: "#2a1630",
      windows: "#ffb070",
      fire: "#ff6a2a",
      lit: 0.6,
      ruin: 0.35,
    }),
    shapes: [
      { kind: "citadel", color: "#07050c", color2: "#ff4a5a", pos: [9, 6, -70], scale: 1.2 },
    ],
    particles: [
      { mode: "blacksnow", color: "#05040a", count: 500, area: [16, -2, 12, -10, -40] },
      { mode: "embers", color: "#ff8a3c", area: [16, -2, 5, -4, -30] },
    ],
  },
  "white-silence": {
    intent: "The light went white: the street, the parents and every sound are gone at once.",
    sky: {
      top: "#bfc3cc",
      mid: "#e9e7e4",
      bottom: "#cfcac4",
      band: "#ffffff",
      bandStrength: 0.9,
      clouds: { amount: 0.3, color: "#d8d6d3", light: "#ffffff", speed: 0.2, height: 0.12 },
      white: 0.55,
      whiteColor: "#f1efec",
    },
    fog: { color: "#e9e7e4", near: 6, far: 40 },
    city: terrinia({ color: "#bdbab6", fog: "#e9e7e4", lit: 0, ruin: 0.9, depth: 26 }),
    particles: [
      { mode: "ash", color: "#ffffff", color2: "#d8d4ce", count: 600, area: [12, -3, 7, 4, -18] },
    ],
  },
  ash: {
    intent:
      "The years of ash: grey drifting down over the ruins, cold, with one small lamp still lit somewhere.",
    camera: { lookY: -0.15 },
    fog: { color: "#26272d", near: 8, far: 60 },
    sky: {
      top: "#121317",
      mid: "#2a2b31",
      bottom: "#0c0d10",
      band: "#45454d",
      bandStrength: 0.55,
      clouds: { amount: 0.5, color: "#22232a", light: "#4a4a54", speed: 0.25, height: 0.18 },
    },
    city: terrinia({ color: "#0d0e12", fog: "#26272d", lit: 0.02, ruin: 0.8, depth: 30 }),
    lights: {
      lights: [
        {
          color: "#ffb067",
          size: 0.7,
          pos: [3.2, -1.2, -9],
          kind: "lamp",
          intensity: 0.9,
          pulse: 0.12,
        },
      ],
    },
    particles: [
      { mode: "ash", color: "#9a9aa2", color2: "#5c5c64", area: [12, -3, 7, 4, -18] },
      { mode: "snow", color: "#c8ccd6", count: 600, opacity: 0.5, area: [12, -3, 7, 4, -14] },
    ],
  },
  "sphere-cracks": {
    intent:
      "Some years after: a hot grey dawn, a black storm from the north-east, and the Defence Sphere holding eleven minutes, then cracking.",
    camera: { lookY: 0.1 },
    fog: { color: "#3a3040", near: 12, far: 80 },
    sky: {
      top: "#151220",
      mid: "#4a3f55",
      bottom: "#0a0910",
      band: "#ff9a6a",
      bandStrength: 0.6,
      clouds: {
        amount: 0.75,
        color: "#1c1826",
        light: "#c0a0d0",
        under: "#7a4dff",
        speed: 1.2,
        storm: 0.85,
        height: 0.22,
      },
      flash: 0.2,
    },
    city: terrinia({ color: "#0b0a10", fog: "#3a3040", lit: 0.3, ruin: 0.4, fire: "#ff8a3c" }),
    dome: { color: "#8fe6ff", opacity: 0.7, crack: "chapter", cells: 16 },
    shapes: [
      {
        kind: "giant",
        a: 0,
        color: "#0a0810",
        color2: "#ffa24a",
        pos: [11, -2.2, -34],
        scale: 1.6,
      },
    ],
    particles: [{ mode: "blacksnow", color: "#06050a", count: 400, area: [16, -2, 12, -10, -40] }],
  },
  "gantry-square": {
    intent:
      "Gantry Square: the first aspirant energy in battle, threads of light like a string of pearls. It looked like a song.",
    camera: { lookY: 0.2 },
    fog: { color: "#1a2234", near: 12, far: 80 },
    sky: {
      top: "#0e1322",
      mid: "#2a3550",
      bottom: "#07090f",
      band: "#7fd6ff",
      bandStrength: 0.55,
      clouds: {
        amount: 0.5,
        color: "#161c2c",
        light: "#9fe0ff",
        speed: 0.6,
        storm: 0.4,
        height: 0.22,
      },
    },
    city: terrinia({ color: "#070a12", fog: "#1a2234", lit: 0.2, ruin: 0.55 }),
    lattice: [{ mode: "threads", color: "#7fe8ff", color2: "#fff2c4", center: [0, 0, -12] }],
    lights: {
      lights: [
        {
          color: "#e0fff2",
          size: 2.4,
          pos: [-4.4, 2.8, -12],
          kind: "orb",
          intensity: 1.3,
          pulse: 0.5,
        },
        {
          color: "#7fd6ff",
          size: 1.0,
          pos: [3.6, 2.0, -16],
          kind: "star",
          intensity: 1.2,
          pulse: 0.7,
        },
      ],
    },
    particles: [
      { mode: "embers", color: "#9fe8ff", color2: "#fff2c4", area: [14, -2, 7, -6, -24] },
    ],
  },
  "ray-of-sun": {
    intent:
      "When it is over: a single ray of sun breaks through the clouds onto the ruins, warm and fading.",
    camera: { lookY: 0 },
    fog: { color: "#5a5060", near: 12, far: 80 },
    sky: {
      top: "#22222f",
      mid: "#7a6c7c",
      bottom: "#120f16",
      band: "#ffd08a",
      bandStrength: 0.7,
      sun: { x: 0.2, y: 0.34, size: 0.03, color: "#ffe2a8", glow: 2.0 },
      clouds: {
        amount: 0.8,
        color: "#34303e",
        light: "#ffe0a8",
        speed: 0.3,
        storm: 0.3,
        height: 0.26,
      },
      pillar: { x: 0.18, color: "#ffe0a8", width: 0.03 },
    },
    city: terrinia({ color: "#120f16", fog: "#5a5060", lit: 0.1, ruin: 0.6 }),
    particles: [motes("#ffe2a8")],
  },
  "crater-garden": {
    intent:
      "The crater planted as a garden, a slender glass tower with a crystal lantern on its lip: a school of reasons.",
    camera: { lookY: -0.3 },
    fog: { color: "#dfe6ec", near: 16, far: 90 },
    sky: {
      top: "#9ab8d8",
      mid: "#eef0f0",
      bottom: "#3a4a3a",
      band: "#ffd9a8",
      bandStrength: 0.8,
      sun: { x: -0.3, y: 0.02, size: 0.028, color: "#ffe6b8", glow: 1.1, rise: 0.06 },
      clouds: { amount: 0.2, color: "#cfd6de", light: "#fff4e4", speed: 0.3, height: 0.22 },
    },
    city: terrinia({
      color: "#5a6878",
      fog: "#dfe6ec",
      lit: 0.1,
      height: 0.6,
      tower: { x: 1.6, height: 8, lamp: "#bff3ff", window: 0.98 },
    }),
    shapes: [
      {
        kind: "tree",
        color: "#3a4a34",
        color2: "#a8e08a",
        a: 0.15,
        pos: [-3.4, -2.2, -6],
        scale: 0.8,
      },
      {
        kind: "tree",
        color: "#3a4a34",
        color2: "#a8e08a",
        a: -0.1,
        pos: [4.6, -2.2, -9],
        scale: 0.6,
      },
    ],
    particles: [motes("#fff2d0", "#bff3ff", { count: 400 })],
  },

  // Part Five -------------------------------------------------------------------------------
  "storm-roof": {
    intent:
      "A summer storm off the sea: lightning on the Academy roof, and across the city one yellow lamp. Someone's always waiting.",
    camera: { lookY: 0.1 },
    fog: { color: "#0d1020", near: 10, far: 70 },
    sky: {
      top: "#04050b",
      mid: "#191e33",
      bottom: "#04050a",
      band: "#3a3f66",
      bandStrength: 0.5,
      clouds: {
        amount: 0.9,
        color: "#0a0c18",
        light: "#9aa8ff",
        under: "#5a6cff",
        speed: 1.4,
        storm: 1,
        height: 0.22,
      },
      flash: 0.45,
      water: { color: "#06080f", glitter: 0.3 },
    },
    city: terrinia({
      color: "#05060c",
      fog: "#0d1020",
      lit: 0.06,
      tower: { x: -4.5, height: 3, lamp: "#ffd36b", window: 0.6 },
    }),
    particles: [
      { mode: "rain", color: "#9aa4d0", tilt: 0.3, opacity: 0.35, area: [14, -3, 8, 4, -16] },
    ],
  },
  "orb-void": {
    intent:
      "Long ago, in another universe: the Twilight Orb breaks, and its light tears a hole between two universes.",
    camera: { lookY: 0.2 },
    sky: {
      top: "#020205",
      mid: "#08081a",
      bottom: "#020204",
      band: "#151030",
      bandStrength: 0.45,
      stars: 0.7,
    },
    shapes: [
      {
        kind: "orb",
        color: "#d6c6ff",
        color2: "#1a1030",
        a: 1.4,
        drive: "chapter",
        pos: [0, 0.9, -6],
        scale: 1.2,
      },
    ],
    lights: {
      lights: [
        {
          color: "#c9b6ff",
          size: 9,
          pos: [0, 0.9, -6.4],
          kind: "flare",
          intensity: 0.8,
          pulse: 0.2,
        },
      ],
    },
    particles: [
      {
        mode: "sparks",
        color: "#e0d4ff",
        color2: "#8a6aff",
        tilt: -0.4,
        count: 400,
        area: [8, -4, 6, -2, -14],
      },
      { mode: "stars", color: "#cfd6ff", count: 900, area: [30, -10, 14, -10, -70] },
    ],
  },
  "matrix-lattice": {
    intent:
      "The Mother Matrix: a vast, cold silver web hidden in the void, turning the Will's thoughts into orders.",
    camera: { lookY: 0.4 },
    sky: {
      top: "#020306",
      mid: "#060a14",
      bottom: "#020306",
      band: "#101a2e",
      bandStrength: 0.4,
      stars: 0.3,
    },
    lattice: [
      { mode: "matrix", color: "#9aa8c8", color2: "#eef4ff", center: [0, 1, -42], grow: "chapter" },
    ],
    particles: [{ mode: "stars", color: "#cfd8ff", count: 1000, area: [40, -12, 18, -20, -90] }],
  },
  sleepers: {
    intent:
      "Rows of sleeping Enders, still as stones. One of thousands has opened her eyes, and she does not move.",
    camera: { lookY: -0.2 },
    sky: { top: "#030208", mid: "#0c0718", bottom: "#020105", band: "#2a1650", bandStrength: 0.45 },
    shapes: [{ kind: "hall", a: 0, b: 14, color: "#0a0812", color2: "#4a30a0", color3: "#040309" }],
    lights: {
      lights: [
        {
          color: "#ffa24a",
          size: 0.28,
          pos: [-0.09, 0.05, -14],
          kind: "orb",
          intensity: 1.6,
          pulse: 0.1,
        },
        {
          color: "#ffa24a",
          size: 0.28,
          pos: [0.09, 0.05, -14],
          kind: "orb",
          intensity: 1.6,
          pulse: 0.1,
        },
      ],
    },
    particles: [motes("#7a5ad0", undefined, { count: 300, area: [8, -2, 4, 2, -40] })],
  },
  "hall-of-sleepers": {
    intent:
      "The Hall of the Sleepers: a hundred thousand Enders in cold violet glass, and their amber eyes opening row by row.",
    camera: { lookY: -0.2 },
    sky: { top: "#030208", mid: "#0c0718", bottom: "#020105", band: "#2a1650", bandStrength: 0.45 },
    shapes: [{ kind: "hall", a: 0, b: 14, color: "#0a0812", color2: "#5a3cc0", color3: "#040309" }],
    particles: [
      {
        mode: "eyes",
        color: "#ffa24a",
        amount: "chapter",
        area: [2.4, -0.2, 3, 0, -60],
        size: 0.07,
      },
    ],
  },
  citadel: {
    intent:
      "The Storm Citadel: tall and spired, red light in its seams. Other motherships carry a storm. The Citadel is a storm.",
    camera: { lookY: 0.9 },
    sky: {
      top: "#04030a",
      mid: "#120a1e",
      bottom: "#030207",
      band: "#3a1230",
      bandStrength: 0.55,
      clouds: {
        amount: 0.7,
        color: "#0b0612",
        light: "#ff4a5a",
        under: "#5a1a3a",
        speed: 1,
        storm: 0.8,
        height: 0.18,
      },
      flash: 0.2,
    },
    shapes: [
      {
        kind: "citadel",
        color: "#060409",
        color2: "#ff3b4e",
        pos: [0, 2.6, -34],
        scale: 1.3,
        drive: "chapter",
      },
    ],
    particles: [
      { mode: "darts", color: "#ff6a5a", area: [6, 1, 6, -30, -36] },
      { mode: "stars", color: "#ffd0d6", count: 600, area: [30, 0, 16, -30, -80] },
    ],
  },
  vats: {
    intent:
      "The Chamber of Likenesses: vats of slow light, and in the newest an infant who opens clear ruby eyes, with interest.",
    camera: { lookY: -0.1 },
    sky: { top: "#020306", mid: "#08090f", bottom: "#020205", band: "#151824", bandStrength: 0.4 },
    shapes: [{ kind: "hall", a: 1, b: 12, color: "#0b0d14", color2: "#5a6cff", color3: "#030407" }],
    lights: {
      lights: [
        {
          color: "#ff4a5a",
          size: 0.22,
          pos: [-0.06, -0.3, -5],
          kind: "orb",
          intensity: 1.5,
          pulse: 0.15,
        },
        {
          color: "#ff4a5a",
          size: 0.22,
          pos: [0.06, -0.3, -5],
          kind: "orb",
          intensity: 1.5,
          pulse: 0.15,
        },
      ],
    },
    particles: [motes("#8a9cff", undefined, { count: 260, area: [6, -2, 3, 2, -30] })],
  },
  "rain-glass": {
    intent:
      "Hollin Reach: rain sideways from bruise-coloured clouds, scorched black glass, a rescue lantern, a child who is measuring.",
    camera: { lookY: -0.4 },
    sky: {
      top: "#120e20",
      mid: "#3a2a4a",
      bottom: "#060509",
      band: "#6a4a6a",
      bandStrength: 0.55,
      clouds: {
        amount: 0.75,
        color: "#251c34",
        light: "#a07ab0",
        speed: 1.4,
        storm: 0.6,
        height: 0.18,
      },
      water: { color: "#06050a", glitter: 0.35, waves: 0.25 },
    },
    lights: {
      lights: [
        {
          color: "#ffc27a",
          size: 1.4,
          pos: [-2.6, -1.5, -7],
          kind: "lamp",
          intensity: 1.0,
          pulse: 0.3,
        },
      ],
    },
    particles: [
      { mode: "rain", color: "#b0a0c8", tilt: 0.9, opacity: 0.45, area: [16, -3, 8, 4, -14] },
    ],
  },

  // Part Six --------------------------------------------------------------------------------
  "forty-days": {
    intent:
      "Operation Harvest: forty thousand Enders, forty days. A ring of forty ticks fills as the plan is made.",
    camera: { lookY: -0.2 },
    fog: { color: "#a4b4cc", near: 14, far: 90 },
    sky: {
      top: "#2a3a5c",
      mid: "#a9bbd4",
      bottom: "#1a2438",
      band: "#ffd2a8",
      bandStrength: 0.7,
    },
    city: terrinia({ color: "#283650", fog: "#a4b4cc", lit: 0.35 }),
    dome: { color: "#bff3ff", opacity: 0.35, cells: 16 },
    shapes: [
      {
        kind: "ticks",
        color: "#b48cff",
        color2: "#4a5878",
        a: 3.2,
        pos: [0, 0.9, -6],
        drive: "chapter",
      },
    ],
    particles: [motes("#e2d6ff", undefined, { count: 300 })],
  },
  aperture: {
    intent:
      "Just before sunrise the Aperture opens in the courtyard, a disc of violet light hanging like a mirror.",
    camera: { lookY: 0 },
    fog: { color: "#4a4a7a", near: 10, far: 70 },
    sky: {
      top: "#1a2140",
      mid: "#6a6a9a",
      bottom: "#0c0f1e",
      band: "#ffb88a",
      bandStrength: 0.7,
    },
    city: terrinia({
      color: "#121630",
      fog: "#4a4a7a",
      lit: 0.3,
      depth: 24,
      tower: { x: -5, height: 7 },
    }),
    shapes: [
      { kind: "portal", color: "#d2b4ff", color2: "#8a5cff", a: 2.3, b: 1, pos: [0.4, 0.4, -7] },
    ],
    particles: [motes("#d8c8ff", undefined, { count: 400 })],
  },
  "institute-hall": {
    intent:
      "Inside the Institute on Oro: cold green machine halls, oil and cold, and pink eyes waiting in the dark.",
    camera: { lookY: -0.1 },
    sky: { top: "#020604", mid: "#08120e", bottom: "#020403", band: "#103426", bandStrength: 0.45 },
    shapes: [{ kind: "hall", a: 2, b: 14, color: "#08100d", color2: "#3cffb0", color3: "#020604" }],
    particles: [
      { mode: "eyes", color: "#ff5ab8", amount: 0.12, area: [6, -0.6, 2, 0, -50], size: 0.05 },
      motes("#7affc8", undefined, { count: 200, area: [6, -2, 3, 2, -30] }),
    ],
  },
  "virtual-battlefield": {
    intent:
      "The Virtual Battlefield: ten thousand tiny lights make a ruined city where Team B3 learns to lean.",
    camera: { lookY: -0.1 },
    sky: { top: "#04070d", mid: "#0c1420", bottom: "#03050a", band: "#1a3a50", bandStrength: 0.5 },
    city: terrinia({
      color: "#000000",
      fog: "#0c1420",
      windows: "#7fe8ff",
      lit: 0.95,
      ruin: 0.5,
      points: true,
      depth: 30,
    }),
    shapes: [
      { kind: "giant", a: 0, color: "#05070c", color2: "#ffa24a", pos: [7, -2.2, -26], scale: 1.1 },
    ],
    particles: [motes("#9fe8ff", undefined, { count: 300 })],
  },
  "breach-alert": {
    intent:
      "Alert: a tuned breach in the Sphere, Enders drifting down through it like black snow, a library burning.",
    camera: { lookY: 0.3 },
    fog: { color: "#2a1418", near: 12, far: 80 },
    sky: {
      top: "#100a14",
      mid: "#3a2030",
      bottom: "#07050a",
      band: "#ff6a3a",
      bandStrength: 0.7,
      clouds: {
        amount: 0.5,
        color: "#1a0e16",
        light: "#ff8a5a",
        speed: 0.8,
        storm: 0.5,
        height: 0.2,
      },
    },
    city: terrinia({
      color: "#07050a",
      fog: "#2a1418",
      windows: "#ff9a5a",
      fire: "#ff5a2a",
      lit: 0.55,
      ruin: 0.3,
    }),
    dome: { color: "#8fe6ff", opacity: 0.6, crack: 0.35, cells: 16 },
    particles: [
      { mode: "blacksnow", color: "#05040a", count: 500, area: [8, -1, 12, -14, -40] },
      { mode: "embers", color: "#ff7a3a", area: [14, -2, 5, -4, -30] },
    ],
  },
  "burning-street": {
    intent:
      "Cover me: a burning street in red light, an Ultra the size of a mountain, two girls behind one plan.",
    camera: { lookY: 0.2 },
    fog: { color: "#3a1410", near: 8, far: 60 },
    sky: {
      top: "#22090c",
      mid: "#7a2618",
      bottom: "#0c0405",
      band: "#ff8a3a",
      bandStrength: 0.7,
      clouds: { amount: 0.5, color: "#2a0e0e", light: "#ffb06a", speed: 0.6, height: 0.22 },
    },
    city: terrinia({
      color: "#120607",
      fog: "#3a1410",
      windows: "#ff8a3a",
      fire: "#ff5a1a",
      lit: 0.55,
      ruin: 0.7,
      depth: 26,
    }),
    shapes: [
      { kind: "giant", a: 0, color: "#0c0506", color2: "#ffa24a", pos: [3, -2.2, -22], scale: 1.4 },
    ],
    particles: [
      { mode: "embers", color: "#ff9a4a", area: [14, -2, 6, -2, -24] },
      { mode: "ash", color: "#3a2a28", count: 500, area: [12, -3, 7, 4, -18] },
    ],
  },

  // Part Seven ------------------------------------------------------------------------------
  "oro-dome": {
    intent:
      "Dorado at six o'clock: amber lamps round the rim of the glass Dome glow on command. It looks like sunshine. It is not.",
    camera: { lookY: 0.2 },
    fog: { color: "#6a4a26", near: 12, far: 80 },
    sky: {
      top: "#2a1c10",
      mid: "#b07a36",
      bottom: "#120c06",
      band: "#ffd08a",
      bandStrength: 0.7,
      sun: { x: 0, y: 0.34, size: 0.07, color: "#ffb347", glow: 0.9, ring: 1 },
    },
    city: terrinia({ color: "#24170c", fog: "#6a4a26", windows: "#ffd08a", lit: 0.55 }),
    dome: {
      color: "#ffcf8a",
      opacity: 0.4,
      cells: 22,
      center: [0, -2.2, -22],
      radius: 42,
      fill: 0.25,
    },
    particles: [motes("#ffd8a0", undefined, { count: 400 })],
  },
  "real-sun": {
    intent:
      "The rim of the Dome: a brown, wide sky with no walls and a dull red sun. A poor, sickly dawn, but it does not pretend.",
    camera: { lookY: -0.1 },
    fog: { color: "#6a4a36", near: 14, far: 90 },
    sky: {
      top: "#2a1c16",
      mid: "#6a4a36",
      bottom: "#1a110c",
      band: "#b8432f",
      bandStrength: 0.7,
      sun: { x: 0.12, y: 0.012, size: 0.05, color: "#c8452a", glow: 0.7, rise: 0.05 },
      clouds: { amount: 0.3, color: "#4a3326", light: "#b06a4a", speed: 0.3, height: 0.16 },
    },
    dome: { color: "#ffcf8a", opacity: 0.35, cells: 10, center: [0, -2.2, 14], radius: 16 },
    particles: [{ mode: "dust", color: "#a06a4a", count: 700, area: [16, -2, 3, -2, -30] }],
  },
  "cyan-bay": {
    intent:
      "The secret workshop: a clean bay of cold cyan light, a ring of glass, a cradle with four white arms. Does it hurt?",
    camera: { lookY: 0 },
    sky: { top: "#03080c", mid: "#0a1a22", bottom: "#020507", band: "#1a4a5a", bandStrength: 0.5 },
    shapes: [
      { kind: "portal", color: "#9ff0ff", color2: "#0a2a3a", a: 1.8, b: 0.15, pos: [0, 0.3, -5] },
    ],
    lights: {
      lights: [
        {
          color: "#7fe8ff",
          size: 3.2,
          pos: [0, 0.3, -5.4],
          kind: "orb",
          intensity: 0.6,
          pulse: 0.12,
        },
        {
          color: "#ff6ac8",
          size: 0.5,
          pos: [0.15, 0.1, -4.8],
          kind: "star",
          intensity: 1,
          pulse: 0.6,
        },
      ],
    },
    particles: [motes("#9ff0ff", undefined, { count: 260, area: [6, -2, 3, 1, -10] })],
  },
  "glass-garden": {
    intent:
      "A secret garden under hexagon glass at the top of the Dome: the false sun falls in golden bars. I feel warm.",
    camera: { lookY: 0.4 },
    fog: { color: "#f0ddb0", near: 10, far: 60 },
    sky: {
      top: "#c9a86a",
      mid: "#ffe6b0",
      bottom: "#4a5a30",
      band: "#fff2d0",
      bandStrength: 0.8,
      sun: { x: 0, y: 0.36, size: 0.05, color: "#ffcf7a", glow: 1, ring: 1 },
    },
    dome: {
      color: "#fff0c8",
      opacity: 0.55,
      cells: 10,
      center: [0, -2.2, -4],
      radius: 16,
      fill: 0.2,
    },
    shapes: [
      {
        kind: "tree",
        color: "#3a5a30",
        color2: "#a8e88a",
        a: 0.1,
        pos: [-3.6, -2.2, -6],
        scale: 1.1,
      },
      {
        kind: "tree",
        color: "#3a5a30",
        color2: "#a8e88a",
        a: -0.2,
        pos: [3.8, -2.2, -7],
        scale: 0.9,
      },
    ],
    particles: [motes("#fff0c0", undefined, { count: 500 })],
  },
  "oro-cleansing": {
    intent:
      "The Cleansing of Oro: a patch of sky goes dark, something huge turns inside it, violet lightning, and dome after dome falls.",
    camera: { lookY: 0.4 },
    fog: { color: "#1a0c24", near: 12, far: 80 },
    sky: {
      top: "#05030a",
      mid: "#1a0c24",
      bottom: "#030207",
      band: "#5a2a7a",
      bandStrength: 0.55,
      clouds: {
        amount: 0.85,
        color: "#0a0612",
        light: "#b08aff",
        under: "#7a3cff",
        speed: 1.4,
        storm: 1,
        height: 0.2,
      },
      vortex: { amount: 0.3, color: "#5a3a9a", color2: "#1a0c2a" },
      flash: 0.45,
    },
    city: terrinia({ color: "#07050a", fog: "#1a0c24", windows: "#ffb347", lit: 0.35, ruin: 0.6 }),
    dome: { color: "#ffcf8a", opacity: 0.45, crack: 0.6, cells: 22, center: [0, -2.2, -40] },
    particles: [{ mode: "blacksnow", color: "#05030a", count: 400, area: [16, -2, 12, -10, -40] }],
  },
  core: {
    intent:
      "The Core: a crystal ball of white and violet threads that pulses like a slow heartbeat. A leash.",
    camera: { lookY: 0.3 },
    sky: { top: "#020206", mid: "#07060e", bottom: "#020204", band: "#120e22", bandStrength: 0.4 },
    shapes: [
      { kind: "orb", color: "#ece4ff", color2: "#3a2a7a", a: 0, pos: [0, 0.6, -5], scale: 0.75 },
    ],
    lattice: [
      { mode: "ring", color: "#cfc6ff", color2: "#ffffff", center: [0, 0.6, -5], scale: 0.9 },
    ],
    particles: [motes("#c9b6ff", undefined, { count: 300, area: [6, -2, 4, 0, -14] })],
  },
  "violet-gate": {
    intent:
      "The sixth morning: a gate of violet fire over Dorado, a hundred and twenty thousand Legion in step, Enders above like a storm that forgot to break.",
    camera: { lookY: 0.5 },
    fog: { color: "#3a1a3a", near: 12, far: 80 },
    sky: {
      top: "#1a0c22",
      mid: "#7a4a6a",
      bottom: "#0a050c",
      band: "#ffb08a",
      bandStrength: 0.7,
    },
    city: terrinia({ color: "#1a0f14", fog: "#3a1a3a", windows: "#ffd08a", lit: 0.3 }),
    shapes: [
      { kind: "portal", color: "#c08aff", color2: "#6a3cff", a: 5, b: 1, pos: [0, 5.5, -34] },
    ],
    particles: [
      { mode: "eyes", color: "#ff6ac8", amount: 1, area: [9, -2.1, -1.8, 2, -50], size: 0.05 },
      { mode: "blacksnow", color: "#06030a", count: 400, area: [20, 4, 10, -20, -50], speed: 0.2 },
    ],
  },
  "command-hold": {
    intent:
      "The dark hold of a command ship: rows of sleeping Legion. You are crying. Is it a malfunction?",
    camera: { lookY: -0.1 },
    sky: { top: "#030206", mid: "#0a0710", bottom: "#020104", band: "#2a0f24", bandStrength: 0.4 },
    shapes: [{ kind: "hall", a: 0, b: 12, color: "#0a0810", color2: "#7a2a5a", color3: "#030206" }],
    lights: {
      lights: [
        {
          color: "#7fd6ff",
          size: 0.25,
          pos: [-0.05, -0.2, -4],
          kind: "orb",
          intensity: 1.4,
          pulse: 0.1,
        },
        {
          color: "#7fd6ff",
          size: 0.25,
          pos: [0.05, -0.2, -4],
          kind: "orb",
          intensity: 1.4,
          pulse: 0.1,
        },
      ],
    },
    particles: [
      { mode: "eyes", color: "#ff6ac8", amount: 0.06, area: [7, -0.6, 1.4, 1, -40], size: 0.05 },
    ],
  },

  // Part Eight ------------------------------------------------------------------------------
  "breach-sunset": {
    intent:
      "The Day of the Breach at golden hour: gold and rose clouds, a deep blue sky, green where they meet, and a small silver ship.",
    camera: { lookY: 0.15 },
    fog: { color: "#c98a6a", near: 14, far: 90 },
    sky: {
      top: "#1b2a5c",
      mid: "#5a8a8c",
      bottom: "#140c10",
      band: "#ffc35a",
      bandStrength: 0.85,
      sun: { x: -0.24, y: 0.035, size: 0.04, color: "#ffcf7a", glow: 1.5 },
      clouds: { amount: 0.6, color: "#b0606e", light: "#ffd08a", speed: 0.4, height: 0.16 },
    },
    city: terrinia({ color: "#1a1424", fog: "#c98a6a", windows: "#ffd08a", lit: 0.35, ruin: 0.4 }),
    dome: { color: "#d8f6ff", opacity: 0.35, crack: 0.25, cells: 16 },
    shapes: [
      {
        kind: "ship",
        color: "#c9d2dc",
        color2: "#7dffc9",
        color3: "#5ce1ff",
        pos: [4.5, -0.9, -12],
        scale: 0.7,
        drive: "chapter",
      },
    ],
    particles: [motes("#ffe2a8", "#ffb0b8")],
  },
  "legion-wedge": {
    intent:
      "Command mode: a wedge of Legion girls with pink eyes walks into the sunset, magenta fire in their palms.",
    camera: { lookY: 0.1 },
    fog: { color: "#5a2a44", near: 10, far: 70 },
    sky: {
      top: "#1a1030",
      mid: "#9a4a6a",
      bottom: "#0c0610",
      band: "#ffa05a",
      bandStrength: 0.75,
      clouds: { amount: 0.5, color: "#4a2440", light: "#ff9a8a", speed: 0.4, height: 0.18 },
    },
    city: terrinia({ color: "#140a14", fog: "#5a2a44", windows: "#ff9a6a", lit: 0.3, ruin: 0.6 }),
    particles: [
      { mode: "eyes", color: "#ff4fb8", amount: 1, area: [3.5, -1.2, -0.4, -2, -26], size: 0.06 },
      { mode: "embers", color: "#ff4fb8", color2: "#ffb0e0", area: [8, -2, 4, -2, -24] },
    ],
  },
  "red-plain": {
    intent:
      "A plain of red dust: a gold giant with a red gem as big as a door, a beam as wide as a street, then a white flash.",
    camera: { lookY: 0.2 },
    fog: { color: "#6a2a18", near: 12, far: 90 },
    sky: {
      top: "#260c0a",
      mid: "#8a3a22",
      bottom: "#3a120a",
      band: "#ffb07a",
      bandStrength: 0.7,
      clouds: { amount: 0.4, color: "#4a1a10", light: "#ffb07a", speed: 0.8, height: 0.12 },
      flash: 0.15,
    },
    shapes: [
      { kind: "giant", a: 1, color: "#2a1608", color2: "#ff3a2a", pos: [0, -2.2, -40], scale: 2.4 },
    ],
    particles: [{ mode: "dust", color: "#d07a4a", area: [18, -2.2, 2, 2, -40] }],
  },
  "harbour-quay": {
    intent:
      "The harbour front for forty-one minutes: a grey quay, the long white Embankment, a silver and gold rope across twelve paces of smoke.",
    camera: { lookY: -0.2 },
    fog: { color: "#a8acb4", near: 12, far: 80 },
    sky: {
      top: "#5a6a7a",
      mid: "#c9ccd0",
      bottom: "#262a30",
      band: "#ffe0b0",
      bandStrength: 0.75,
      sun: { x: 0.3, y: 0.06, size: 0.03, color: "#ffe6b8", glow: 1 },
      water: { color: "#2a3440", glitter: 0.8 },
    },
    city: terrinia({ color: "#3a4048", fog: "#a8acb4", lit: 0.08, depth: 34 }),
    lattice: [
      { mode: "threads", color: "#f0f4ff", color2: "#ffd36b", center: [0, -0.6, -8], scale: 0.5 },
    ],
    lights: {
      lights: [
        {
          color: "#ffd96b",
          size: 1.1,
          pos: [-4.4, -1.4, -8],
          kind: "star",
          intensity: 1.3,
          pulse: 0.6,
        },
        {
          color: "#e6ecff",
          size: 1.1,
          pos: [3.6, 1.1, -14],
          kind: "star",
          intensity: 1.3,
          pulse: 0.6,
        },
      ],
    },
    particles: [motes("#fff2d6", "#e6ecff", { count: 400 })],
  },
  "silver-line": {
    intent:
      "A silver line across the sky and a cold pale light: the Cradle shatters into gold dust and the Enders turn north.",
    camera: { lookY: 0.3 },
    fog: { color: "#7a88a0", near: 14, far: 90 },
    sky: {
      top: "#2a3550",
      mid: "#8a9ab0",
      bottom: "#141a26",
      band: "#e8eef6",
      bandStrength: 0.7,
    },
    city: terrinia({ color: "#1a2030", fog: "#7a88a0", lit: 0.2, ruin: 0.45 }),
    dome: { color: "#d8f6ff", opacity: 0.3, crack: 0.5, cells: 16 },
    lights: {
      lights: [
        { color: "#eef4ff", size: 40, pos: [0, 6, -50], kind: "flare", intensity: 1.2, pulse: 0.1 },
      ],
    },
    particles: [
      { mode: "snow", color: "#ffd36b", color2: "#fff0c0", count: 700, area: [14, -3, 8, 4, -18] },
    ],
  },
  "roof-night": {
    intent:
      "A roof above the ruins at night: two who could stand side by side. It is only the first morning of the longest day.",
    camera: { lookY: 0 },
    fog: { color: "#22305a", near: 14, far: 80 },
    sky: {
      top: "#0a1024",
      mid: "#22305a",
      bottom: "#060914",
      band: "#5a6a9a",
      bandStrength: 0.55,
      stars: 0.8,
    },
    city: terrinia({ color: "#070b18", fog: "#22305a", lit: 0.25, ruin: 0.4 }),
    particles: [motes("#cfe0ff", undefined, { count: 300 })],
  },

  // Part Nine -------------------------------------------------------------------------------
  "garden-morning": {
    intent:
      "Quiet repair: dawn on the crater garden, clear water running in a dry fountain, a small machine chirping I'm here.",
    camera: { lookY: -0.4 },
    fog: { color: "#dfe8ec", near: 14, far: 80 },
    sky: {
      top: "#a8c4dc",
      mid: "#eef3f4",
      bottom: "#2a4038",
      band: "#ffe2b8",
      bandStrength: 0.8,
      sun: { x: -0.26, y: 0.02, size: 0.028, color: "#ffe6b8", glow: 1.1, rise: 0.08 },
      water: { color: "#5a98a8", glitter: 1.3, waves: 0.6 },
    },
    city: terrinia({
      color: "#6a7a88",
      fog: "#dfe8ec",
      lit: 0.05,
      height: 0.6,
      tower: { x: 3, height: 8, lamp: "#bff3ff", window: 0.98 },
    }),
    shapes: [
      {
        kind: "tree",
        color: "#3a4a34",
        color2: "#a8e08a",
        a: 0.12,
        pos: [-3.6, -2.2, -6],
        scale: 0.9,
      },
    ],
    particles: [motes("#fff2d0", "#bff3ff", { count: 400 })],
  },
  badges: {
    intent:
      "Badges of honour in the great glass hall: small gold stars in circles, given so that you know somebody saw.",
    camera: { lookY: 0.2 },
    sky: {
      top: "#c9cfdb",
      mid: "#f4f1ea",
      bottom: "#8a8e98",
      band: "#ffe9c0",
      bandStrength: 0.7,
    },
    dome: { color: "#ffd98a", opacity: 0.3, cells: 12, center: [0, -2.2, -16], radius: 24 },
    lights: {
      lights: Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2;
        return {
          color: "#ffcf5c",
          size: 0.9,
          pos: [Math.cos(a) * 3.2, 1.3 + Math.sin(a) * 1.6, -8] as [number, number, number],
          kind: "star" as const,
          intensity: 1.2,
          pulse: 0.3,
        };
      }),
    },
    particles: [{ mode: "stars", color: "#ffd36b", count: 500, area: [16, -2, 8, -6, -30] }],
  },
  "plane-tree": {
    intent:
      "Under a plane tree in November: the last leaves fall like small gold coins from a high, clear, tender blue sky.",
    camera: { lookY: 0.2 },
    fog: { color: "#cfe0ee", near: 14, far: 80 },
    sky: {
      top: "#6a9ad0",
      mid: "#cfe3f4",
      bottom: "#3a4a3a",
      band: "#fff0d8",
      bandStrength: 0.6,
    },
    shapes: [
      {
        kind: "tree",
        color: "#3a3020",
        color2: "#ffcf5c",
        a: 0.2,
        pos: [-4.2, -2.2, -6],
        scale: 1.5,
      },
    ],
    particles: [
      { mode: "leaves", color: "#ffcf5c", color2: "#e8a040", area: [10, -2.5, 7, 3, -10] },
    ],
  },

  // Part Ten --------------------------------------------------------------------------------
  "attic-rain": {
    intent:
      "The attic in the rain: a little white doll swinging in the round window, and a gold star at a collar that says I'm here.",
    camera: { lookY: -0.05 },
    fog: { color: "#141a2a", near: 10, far: 70 },
    sky: {
      top: "#05070e",
      mid: "#141a2a",
      bottom: "#030409",
      band: "#2a3550",
      bandStrength: 0.5,
      clouds: { amount: 0.5, color: "#0e1220", light: "#4a5a80", speed: 0.5, height: 0.2 },
    },
    city: terrinia({ color: "#05070d", fog: "#141a2a", lit: 0.15 }),
    lights: {
      lights: [
        {
          color: "#ffd8a0",
          size: 1.6,
          pos: [3.4, 0.9, -6],
          kind: "lamp",
          intensity: 0.8,
          pulse: 0.06,
        },
        {
          color: "#ffd36b",
          size: 1.1,
          pos: [-2.8, 0.4, -5],
          kind: "star",
          intensity: 1.1,
          pulse: 0.5,
        },
      ],
    },
    particles: [
      { mode: "rain", color: "#8a9ac0", tilt: 0.1, opacity: 0.35, area: [12, -3, 8, 4, -14] },
    ],
  },
  corridor: {
    intent:
      "The long white corridor under the tower: cold blue lamps, Enders out of the dark, and at the end a black gate.",
    camera: { lookY: 0 },
    sky: { top: "#05070c", mid: "#05070c", bottom: "#05070c", band: "#05070c", bandStrength: 0 },
    shapes: [
      {
        kind: "corridor",
        color: "#aab4c4",
        color2: "#6fb6ff",
        color3: "#05070c",
        a: 0.22,
        b: 0.58,
        drive: "chapter",
      },
    ],
  },
  "void-fall": {
    intent:
      "Falling into the void: the only light is her Emblem, and the memories float round her like open windows.",
    camera: { lookY: 0 },
    sky: {
      top: "#020308",
      mid: "#05060f",
      bottom: "#010205",
      band: "#0c0f22",
      bandStrength: 0.4,
      stars: 0.2,
    },
    shapes: [{ kind: "memories", color: "#ffd36b" }],
    lights: {
      lights: [
        {
          color: "#ffd36b",
          size: 1.4,
          pos: [0, -1.1, -3],
          kind: "star",
          intensity: 1.4,
          pulse: 0.4,
        },
      ],
    },
    particles: [
      {
        mode: "embers",
        color: "#c9d6ff",
        count: 300,
        opacity: 0.6,
        area: [10, -6, 6, -2, -20],
        speed: 2,
      },
    ],
  },
  "ice-plain": {
    intent:
      "The pole: a perfect black disc on a plain of ice, and far to the north in the sky, the same note as the star. I'm here.",
    camera: { lookY: 0.3 },
    sky: {
      top: "#0a1430",
      mid: "#4a6a9a",
      bottom: "#dfe8f2",
      band: "#c9e6ff",
      bandStrength: 0.75,
      aurora: { amount: 0.9, color: "#5affc8" },
      stars: 0.4,
    },
    shapes: [
      { kind: "portal", color: "#9fb8ff", color2: "#000000", a: 0.9, b: 0, pos: [0, -1.4, -9] },
    ],
    lights: {
      lights: [
        {
          color: "#ffd96b",
          size: 1.6,
          pos: [-2, 5.6, -60],
          kind: "star",
          intensity: 1.4,
          pulse: 0.35,
        },
      ],
    },
    particles: [{ mode: "snow", color: "#eef4ff", count: 900, area: [12, -3, 7, 4, -16] }],
  },
  "citadel-hall": {
    intent:
      "Inside the Storm Citadel: a column like a spine ringed with red eyes, and a gold-haloed Guardian kneeling in violet smoke.",
    camera: { lookY: 0.6 },
    sky: { top: "#030206", mid: "#0c0610", bottom: "#020104", band: "#2a0a1a", bandStrength: 0.45 },
    shapes: [
      { kind: "hall", a: 3, color: "#0a0608", color2: "#ff3a4a", color3: "#030204" },
      {
        kind: "giant",
        a: 2,
        color: "#0d0a10",
        color2: "#ffd36b",
        color3: "#ffcf5c",
        pos: [-6, -2.2, -18],
        scale: 0.9,
      },
    ],
    particles: [motes("#8a5ad0", "#ff4a5a", { count: 500, area: [10, -2, 6, -2, -30] })],
  },
  "citadel-garden": {
    intent:
      "A garden at the top of the Citadel, open to the storm: one crooked tree leaning east, toward a sunrise that never came.",
    camera: { lookY: 0.1 },
    fog: { color: "#1a1430", near: 8, far: 60 },
    sky: {
      top: "#05040c",
      mid: "#1a1430",
      bottom: "#030207",
      band: "#3a2a5a",
      bandStrength: 0.5,
      clouds: {
        amount: 0.85,
        color: "#0c0a18",
        light: "#c9b6ff",
        under: "#5a3cc0",
        speed: 1.2,
        storm: 0.9,
        height: 0.2,
      },
      flash: 0.35,
    },
    shapes: [
      {
        kind: "tree",
        color: "#2e3a34",
        color2: "#7fdf9a",
        a: 0.5,
        pos: [2.2, -2.2, -5],
        scale: 1.2,
      },
    ],
    particles: [
      { mode: "rain", color: "#9a8cc0", tilt: 0.2, opacity: 0.3, area: [12, -3, 8, 4, -14] },
    ],
  },

  // Part Eleven -----------------------------------------------------------------------------
  "graduation-day": {
    intent:
      "Graduation day in the first week of September: a bright lawn, white chairs, a banner with a stitched dragon.",
    camera: { lookY: 0.1 },
    fog: { color: "#d8e6f2", near: 16, far: 90 },
    sky: {
      top: "#6aa0d8",
      mid: "#e4eff8",
      bottom: "#3a4a3a",
      band: "#fff2dc",
      bandStrength: 0.6,
      sun: { x: 0.34, y: 0.34, size: 0.03, color: "#fff4dc", glow: 1.1 },
      clouds: { amount: 0.25, color: "#dfe6ee", light: "#ffffff", speed: 0.3, height: 0.26 },
    },
    city: terrinia({
      color: "#7a8a9c",
      fog: "#d8e6f2",
      lit: 0,
      height: 0.7,
      tower: { x: -3.5, height: 9, lamp: "#bff3ff", window: 0.98 },
    }),
    dome: { color: "#bff3ff", opacity: 0.3, cells: 16 },
    particles: [motes("#fff4dc", undefined, { count: 300 })],
  },
  "sun-out": {
    intent:
      "Mummy, who turned off the sun? A soft hand covers it; the sky turns crimson and violet and a cold hum comes from the north.",
    camera: { lookY: 0.4 },
    fog: { color: "#2a0c1e", near: 12, far: 80 },
    sky: {
      top: "#12030c",
      mid: "#5a1030",
      bottom: "#07020a",
      band: "#7a3cff",
      bandStrength: 0.6,
      sun: { x: 0.34, y: 0.3, size: 0.03, color: "#5a1a1a", glow: 0.25 },
      clouds: {
        amount: 0.5,
        color: "#2a0a1c",
        light: "#ff4a6a",
        speed: 0.6,
        storm: 0.5,
        height: 0.22,
      },
    },
    city: terrinia({ color: "#07020a", fog: "#2a0c1e", lit: 0.05, tower: { x: -3.5, height: 9 } }),
    particles: [motes("#ff8a9a", undefined, { count: 200 })],
  },
  "rift-opens": {
    intent:
      "Graduation day goes dark: a four-pointed crimson tear opens over the northern sea with the Storm Citadel in its mouth.",
    camera: { lookY: 0.8 },
    fog: { color: "#2a0612", near: 14, far: 100 },
    sky: {
      top: "#0f0208",
      mid: "#4a0c24",
      bottom: "#07030a",
      band: "#ff3b4e",
      bandStrength: 0.75,
      clouds: {
        amount: 0.7,
        color: "#1c0612",
        light: "#ff6a5a",
        under: "#7a3cff",
        speed: 1.1,
        storm: 0.8,
        height: 0.2,
      },
      rift: { x: 0, y: 0.26, size: 0.2, rim: "#ff5a2a", open: "chapter" },
      flash: 0.15,
      water: { color: "#12040c", glitter: 0.6, waves: 1.2 },
    },
    shapes: [
      { kind: "citadel", color: "#050207", color2: "#ff3b4e", pos: [0, 9, -90], scale: 1.6 },
    ],
    particles: [{ mode: "darts", color: "#ff6a5a", area: [8, 6, 12, -80, -90] }],
  },
  "net-unrolls": {
    intent:
      "The Matrix transmits: a great silver net unrolls over Terrinia, every thread a gate, and amber eyes rise from the whirlpools.",
    camera: { lookY: 0.6 },
    fog: { color: "#2a0612", near: 14, far: 100 },
    sky: {
      top: "#0c0207",
      mid: "#3a0a1e",
      bottom: "#060208",
      band: "#ff3b4e",
      bandStrength: 0.6,
      clouds: {
        amount: 0.6,
        color: "#18050f",
        light: "#ff6a5a",
        under: "#7a3cff",
        speed: 0.9,
        storm: 0.7,
        height: 0.2,
      },
      rift: { x: 0, y: 0.3, size: 0.2, rim: "#ff5a2a", open: 1 },
      water: { color: "#10040a", glitter: 0.5, waves: 1.4 },
    },
    lattice: [{ ...NET, grow: "chapter", flaw: true, color2: "#ffb0b8" }],
    particles: [
      {
        mode: "eyes",
        color: "#ffa24a",
        amount: 0.35,
        area: [28, -2.1, -1.7, -16, -70],
        size: 0.07,
      },
    ],
  },

  // Part Twelve -----------------------------------------------------------------------------
  "aspirant-field": {
    intent:
      "Aspirants, unite: nine stand shoulder to shoulder and a dome of their joined light rings like a bell as wide as a city.",
    camera: { lookY: 0.2 },
    fog: { color: "#3a1a1e", near: 12, far: 90 },
    sky: {
      top: "#1a0a14",
      mid: "#5a2a3a",
      bottom: "#0a0408",
      band: "#ffcf8a",
      bandStrength: 0.65,
      rift: { x: 0.25, y: 0.34, size: 0.12, rim: "#ff5a2a", open: 1 },
    },
    city: terrinia({ color: "#0c0608", fog: "#3a1a1e", lit: 0.15, ruin: 0.5 }),
    dome: {
      color: "#ffd27a",
      opacity: 0.95,
      cells: 12,
      center: [0, -2.2, -30],
      radius: 28,
      fill: 0.35,
    },
    lattice: [{ ...NET, opacity: 0.35, flaw: true, color2: "#ffb0b8" }],
    particles: [
      { mode: "embers", color: "#ffd27a", color2: "#7fe8ff", area: [14, -2, 6, -6, -30] },
    ],
  },
  "dead-towers": {
    intent:
      "The dead towers of the northern ward under the red rift: Enders walking the ruins, a small figure on red-gold fire asking where she is.",
    camera: { lookY: 0.3 },
    fog: { color: "#3a0c14", near: 8, far: 60 },
    sky: {
      top: "#14030a",
      mid: "#4a0c1e",
      bottom: "#07020a",
      band: "#ff4a3a",
      bandStrength: 0.7,
      rift: { x: 0.28, y: 0.32, size: 0.12, rim: "#ff5a2a", open: 1 },
      clouds: {
        amount: 0.5,
        color: "#1c0610",
        light: "#ff6a4a",
        speed: 0.8,
        storm: 0.5,
        height: 0.2,
      },
    },
    city: terrinia({
      color: "#0a0306",
      fog: "#3a0c14",
      windows: "#ff7a3a",
      fire: "#ff4a1a",
      lit: 0.2,
      ruin: 1,
      height: 1.6,
      depth: 26,
    }),
    particles: [
      { mode: "embers", color: "#ff8a3a", color2: "#ffd27a", area: [14, -2, 6, -2, -24] },
      { mode: "ash", color: "#3a1a1a", count: 500, area: [12, -3, 7, 4, -18] },
    ],
  },
  "emblem-pillar": {
    intent:
      "Your emblem is still lit: two beams of gold knot in the air and a white pillar rises through the clouds. The Matrix flinches.",
    camera: { lookY: 0.4 },
    fog: { color: "#3a0c14", near: 8, far: 60 },
    sky: {
      top: "#14030a",
      mid: "#4a0c1e",
      bottom: "#07020a",
      band: "#ff4a3a",
      bandStrength: 0.6,
      rift: { x: 0.28, y: 0.32, size: 0.12, rim: "#ff6ac8", open: 1 },
      clouds: {
        amount: 0.5,
        color: "#1c0610",
        light: "#ffffff",
        speed: 0.8,
        storm: 0.5,
        height: 0.22,
      },
      pillar: { x: 0.02, color: "#fff6e8", width: 0.016 },
    },
    city: terrinia({ color: "#0a0306", fog: "#3a0c14", lit: 0.1, ruin: 1, height: 1.6, depth: 26 }),
    lights: {
      lights: [
        { color: "#ffd96b", size: 1.6, kind: "star", intensity: 1.5, pulse: 0.6 },
        { color: "#ffe8b0", size: 1.6, kind: "star", intensity: 1.5, pulse: 0.6 },
      ],
      orbit: { center: [0.3, 0, -6], from: 6, to: 0.2, drive: "chapter", speed: 0.05, sync: true },
    },
    particles: [{ mode: "embers", color: "#fff2d0", area: [10, -2, 8, -2, -20] }],
  },
  "rift-flower": {
    intent:
      "The rift opens like a flower, a black window full of stars, and a horned shape the size of the sky looks through it.",
    camera: { lookY: 0.9 },
    fog: { color: "#2a0612", near: 14, far: 140 },
    sky: {
      top: "#0f0208",
      mid: "#3a0a20",
      bottom: "#07030a",
      band: "#ff3b6e",
      bandStrength: 0.6,
      rift: { x: 0, y: 0.25, size: 0.32, rim: "#ff6ac8", open: 1 },
      clouds: {
        amount: 0.6,
        color: "#1c0612",
        light: "#ff6ac8",
        under: "#7a3cff",
        speed: 1,
        storm: 0.8,
        height: 0.16,
      },
      flash: 0.2,
    },
    shapes: [
      { kind: "giant", a: 3, color: "#0a0612", color2: "#cfe0ff", pos: [0, 4, -120], scale: 7 },
    ],
    particles: [{ mode: "darts", color: "#ff6ac8", area: [12, 6, 12, -60, -80] }],
  },
  "twin-comets": {
    intent:
      "Wings of red and gold fire rise to meet a violet comet: twin streams of light, running round each other like threads in a rope.",
    camera: { lookY: 0.4 },
    sky: {
      top: "#0f0208",
      mid: "#3a0a20",
      bottom: "#07030a",
      band: "#ff6a3a",
      bandStrength: 0.6,
      rift: { x: 0.3, y: 0.36, size: 0.14, rim: "#ff6ac8", open: 1 },
      clouds: {
        amount: 0.5,
        color: "#1c0612",
        light: "#ffb06a",
        speed: 1,
        storm: 0.6,
        height: 0.2,
      },
    },
    shapes: [
      {
        kind: "ribbons",
        color: "#ffb35c",
        color2: "#b07aff",
        c: 1,
        drive: "chapter",
        pos: [0, 0, -2],
      },
    ],
    particles: [
      { mode: "embers", color: "#ffb35c", color2: "#c9a0ff", area: [10, -2, 8, -2, -16] },
    ],
  },
  singularity: {
    intent:
      "The Purge Probe falls like a pillar of white fire, and a black sphere ten metres wide drinks it like water into a drain.",
    camera: { lookY: 0.5 },
    sky: {
      top: "#0a0510",
      mid: "#2a0c22",
      bottom: "#05020a",
      band: "#ff6a5a",
      bandStrength: 0.55,
      rift: { x: 0, y: 0.34, size: 0.16, rim: "#ff5a2a", open: 1 },
      pillar: { x: 0, color: "#fff0e6", width: 0.03 },
    },
    shapes: [
      { kind: "orb", color: "#ffffff", color2: "#000000", a: 0, pos: [0, 1, -8], scale: 1.6 },
    ],
    particles: [{ mode: "sparks", color: "#fff0e6", tilt: 0, area: [3, -1, 10, -6, -10] }],
  },
  "inside-dark": {
    intent:
      "Inside the black hole there is no up or down, only a thread of thought; then the dark grows warm with gold light from her star.",
    camera: { lookY: 0 },
    sky: {
      top: "#030205",
      mid: "#0a0608",
      bottom: "#020103",
      band: "#2a1a10",
      bandStrength: 0.4,
      vortex: { amount: 0.3, color: "#ffcf8a", color2: "#3a1a20" },
    },
    lights: {
      lights: [
        {
          color: "#ffd96b",
          size: 2.6,
          pos: [-0.4, 0, -4],
          kind: "star",
          intensity: 1.4,
          pulse: 0.4,
        },
        {
          color: "#ff9ab8",
          size: 2.0,
          pos: [0.5, 0.1, -4.2],
          kind: "star",
          intensity: 1.2,
          pulse: 0.4,
        },
      ],
    },
    particles: [motes("#ffe2a8", "#ffb0c8", { count: 500, area: [6, -3, 3, 0, -10] })],
  },
  "twin-ribbons": {
    intent:
      "They're coming back: two ribbons of light, gold and rose, twist round each other, climb through the net and come down like snow.",
    camera: { lookY: 0.6 },
    fog: { color: "#c98a9a", near: 14, far: 90 },
    sky: {
      top: "#2a2a4a",
      mid: "#c98a9a",
      bottom: "#140f1c",
      band: "#ffd8a8",
      bandStrength: 0.75,
      sun: { x: 0.3, y: 0.04, size: 0.028, color: "#ffe2b8", glow: 1.2 },
    },
    lattice: [{ ...NET, opacity: 0.4 }],
    shapes: [
      { kind: "ribbons", color: "#ffd36b", color2: "#ff8fb0", drive: "chapter", pos: [0, 0, -2] },
    ],
    particles: [
      { mode: "snow", color: "#ffe6c8", color2: "#ffc0d0", count: 700, area: [12, -3, 8, 4, -16] },
    ],
  },
  "bell-tower": {
    intent:
      "The old sandstone bell tower, two hundred and fourteen steps, and above it a long black hunter with one amber eye.",
    camera: { lookY: 0.4 },
    fog: { color: "#2a0a14", near: 10, far: 80 },
    sky: {
      top: "#12040c",
      mid: "#3a0c22",
      bottom: "#07020a",
      band: "#ff5a4a",
      bandStrength: 0.6,
      rift: { x: -0.3, y: 0.36, size: 0.12, rim: "#ff5a2a", open: 1 },
      clouds: { amount: 0.5, color: "#1c0610", light: "#ff6a5a", speed: 0.8, height: 0.2 },
    },
    city: terrinia({ color: "#120a0c", fog: "#2a0a14", lit: 0.05, tower: { x: 2.6, height: 6.5 } }),
    shapes: [
      {
        kind: "ship",
        color: "#0a0608",
        color2: "#3a1a1a",
        color3: "#ffa24a",
        pos: [-2.6, 3.2, -12],
        scale: 1.6,
      },
    ],
    lights: {
      lights: [
        {
          color: "#ffa24a",
          size: 0.6,
          pos: [-1.2, 3.25, -11.2],
          kind: "orb",
          intensity: 1.5,
          pulse: 0.2,
        },
      ],
    },
  },
  "lightning-road": {
    intent:
      "Here comes the lightning: a long white road splits the clouds up to the red rift, and she takes the scenic route.",
    camera: { lookY: 0.7 },
    sky: {
      top: "#0f0208",
      mid: "#3a0a20",
      bottom: "#07030a",
      band: "#ff3b4e",
      bandStrength: 0.6,
      rift: { x: 0.12, y: 0.36, size: 0.14, rim: "#ff5a2a", open: 1 },
      clouds: {
        amount: 0.85,
        color: "#120410",
        light: "#e6f0ff",
        under: "#7a3cff",
        speed: 1.6,
        storm: 1,
        height: 0.22,
      },
      pillar: { x: 0.12, color: "#e6f0ff", width: 0.01 },
      flash: 0.5,
    },
    shapes: [
      { kind: "citadel", color: "#050207", color2: "#ff3b4e", pos: [6, 12, -100], scale: 1.4 },
    ],
    particles: [
      { mode: "sparks", color: "#e6f0ff", tilt: 0.05, area: [6, -2, 12, -4, -20], speed: 1.6 },
    ],
  },
  "open-space": {
    intent:
      "Open space: the Citadel burns but does not fall, a white flare at the top of the sky, a ring of sparks like slow bright rain.",
    camera: { lookY: 0.4 },
    sky: {
      top: "#020208",
      mid: "#06061a",
      bottom: "#020206",
      band: "#1a1030",
      bandStrength: 0.4,
      stars: 1,
    },
    shapes: [
      { kind: "citadel", color: "#070409", color2: "#ff5a3a", pos: [-7, -1, -50], scale: 1.1 },
    ],
    lights: {
      lights: [
        { color: "#fff6e8", size: 7, pos: [2, 2.6, -24], kind: "orb", intensity: 1.3, pulse: 0.3 },
      ],
    },
    particles: [
      { mode: "sparks", color: "#fff0d8", color2: "#ffb0c8", tilt: 0, area: [10, -4, 8, -14, -30] },
      { mode: "stars", color: "#e6e8ff", count: 1400, area: [40, -12, 18, -20, -90] },
    ],
  },
  "stopped-dawn": {
    intent:
      "Between two and three in the morning: the Enders on the shore stand still, their amber eyes dim, as if struck in the middle of a word.",
    camera: { lookY: -0.3 },
    fog: { color: "#3a4a6a", near: 14, far: 90 },
    sky: {
      top: "#0a1226",
      mid: "#3a4a6a",
      bottom: "#060a14",
      band: "#8aa0c0",
      bandStrength: 0.6,
      water: { color: "#0a1020", glitter: 0.3, waves: 0.3 },
    },
    city: terrinia({ color: "#0a1020", fog: "#3a4a6a", lit: 0.4 }),
    lattice: [{ ...NET, opacity: 0.22 }],
    particles: [
      {
        mode: "eyes",
        color: "#ffa24a",
        amount: 0.6,
        opacity: 0.4,
        area: [30, -2.1, -1.8, -14, -40],
        size: 0.06,
      },
    ],
  },
  "lamp-belfry": {
    intent:
      "All night on the bell tower a mother keeps a little tin oil lamp on the ledge, where the sky can see it, and sings.",
    camera: { lookY: 0.1 },
    fog: { color: "#4a557a", near: 12, far: 80 },
    sky: {
      top: "#121a33",
      mid: "#4a557a",
      bottom: "#0a0e1c",
      band: "#ffb88a",
      bandStrength: 0.7,
      stars: 0.45,
    },
    city: terrinia({
      color: "#0c1022",
      fog: "#4a557a",
      lit: 0.2,
      tower: { x: 2.4, height: 6.5, lamp: "#ffcf7a", window: 0.96 },
    }),
    particles: [motes("#ffe2b8", undefined, { count: 300 })],
  },
  lighthouses: {
    intent:
      "Morning: a hundred and seventeen lighthouses on the far shore begin to sing, and in the north the sun runs down the snow, gold, rose and silver.",
    camera: { lookY: 0.05 },
    fog: { color: "#e6dcd4", near: 20, far: 160 },
    sky: {
      top: "#9fb8d8",
      mid: "#f6e6d8",
      bottom: "#2a3446",
      band: "#ffcf9a",
      bandStrength: 0.8,
      sun: { x: 0.36, y: 0.05, size: 0.03, color: "#fff0d0", glow: 1.2, rise: 0.06 },
      water: { color: "#5a7a9a", glitter: 1.3 },
    },
    shapes: [
      {
        kind: "terrain",
        color: "#f4f6fa",
        color2: "#ffc9a0",
        color3: "#8a94aa",
        a: 1,
        drive: "chapter",
      },
    ],
    lattice: [{ ...NET, opacity: 0.14 }],
    particles: [motes("#fff2dc", undefined, { count: 300 })],
  },
};

export function presetFor(key: SceneKey): Preset {
  return PRESETS[key];
}
