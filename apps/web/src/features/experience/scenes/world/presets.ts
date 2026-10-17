import type { SceneKey } from "../parts";
import type { Preset } from "./types";

/**
 * Every scene composition, keyed by `SceneKey`. Data only: the layers in `World` read it.
 * Each preset starts with a one-line intent: what the picture carries in the story.
 */
export const PRESETS: Partial<Record<SceneKey, Preset>> = {
  "gantry-dawn": {
    intent:
      "Seventy metres up the tower at dawn: the sun climbs out of the sea, cold clear sky, the lake city under the pale hex web.",
    camera: { y: 0, lookY: -0.4 },
    sky: {
      top: "#4f7fb5",
      mid: "#cfe1f1",
      bottom: "#203448",
      band: "#ffd29a",
      bandStrength: 0.85,
      sun: { x: 0.18, y: -0.01, size: 0.032, color: "#ffe0aa", glow: 1.3, rise: 0.14 },
      clouds: { amount: 0.22, color: "#b9c9da", light: "#fff1dc", speed: 0.6, height: 0.2 },
      water: { color: "#29455f", glitter: 1.3, waves: 1 },
    },
  },
  "lanterns-978": {
    intent:
      "First Light in 978: paper lanterns on the water at dusk, like a field of fallen stars, before anyone feared the sky.",
    camera: { y: 0, lookY: -0.9 },
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
  },
  "storm-978": {
    intent:
      "The ninth of September, 978: the sky sings, a cold violet light spreads under the clouds and a thousand sparks fall.",
    camera: { y: 0, lookY: 0.6 },
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
  },
  "white-silence": {
    intent: "The light went white: the street, the parents and every sound are gone at once.",
    camera: { y: 0, lookY: 0 },
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
  },
  "rift-opens": {
    intent:
      "Graduation day goes dark: a four-pointed crimson tear opens over the northern sea with the Storm Citadel in its mouth.",
    camera: { y: 0, lookY: 0.8 },
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
  },
};

const FALLBACK: Preset = PRESETS["gantry-dawn"] as Preset;

export function presetFor(key: SceneKey): Preset {
  return PRESETS[key] ?? FALLBACK;
}
