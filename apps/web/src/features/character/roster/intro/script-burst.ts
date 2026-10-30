import type { PanelScript } from "./script";

/**
 * The burst: the panels after the first one, each opening in its own row (bottom row from the
 * bottom edge, top row and the tall panels from the top edge), showing its clip, an impact frame
 * or two, a cross fade and the splash art. Times are read off the recording at 30 frames a second
 * between 1.55 and 2.8 s. See `script.ts` for what a beat is.
 */
export const BURST: readonly PanelScript[] = [
  {
    // Ruby, bottom row. A dark haired clip, a grey frame, black, a white silhouette, a yellow
    // flame, then the splash with a glow.
    slug: "ruby",
    beats: [
      { t: 1.55, grow: 0.08, mix: 0, clip: 0, rate: 1, step: 20, glow: 0.5, seed: 1 },
      { t: 1.583, grow: 0.2 },
      { t: 1.617, grow: 0.55, glow: 0.7 },
      { t: 1.65, grow: 1, white: 0.4, glow: 1 },
      { t: 1.683, white: 0, black: 1 },
      { t: 1.75, black: 0, thr: 0.38, rate: 0 },
      { t: 1.783, thr: -1, rate: 1, clip: 0.35 },
      { t: 1.85, mix: 0.4, glow: 0.8 },
      { t: 1.917, mix: 0.8 },
      { t: 1.95, mix: 1, glow: 1 },
      { t: 2.05, glow: 0.4 },
      { t: 2.2, glow: 0 },
    ],
  },
  {
    // Layla, top row. A teal orb, a black star at 1.95, then a green ghost on the way to the splash.
    slug: "layla",
    beats: [
      { t: 1.8, grow: 0.25, top: 1, mix: 0, clip: 0, rate: 1, step: 20, glow: 0.4, seed: 2 },
      { t: 1.833, grow: 0.6 },
      { t: 1.85, grow: 1 },
      { t: 1.95, thr: 0.6, rate: 0, glow: 1 },
      { t: 2.1, thr: -1, rate: 1, clip: 0.5, mix: 0.45, white: 0.25 },
      { t: 2.25, mix: 0.8, white: 0.1 },
      { t: 2.4, mix: 1, white: 0, glow: 0.4 },
      { t: 2.6, glow: 0 },
    ],
  },
  {
    // Chang'e, bottom row, left of Ruby. Black, a white silhouette at 2.02, a pink ghost.
    slug: "change",
    beats: [
      { t: 1.917, grow: 0.3, mix: 0, clip: 0, rate: 1, step: 20, black: 1, glow: 0.6, seed: 3 },
      { t: 1.95, grow: 1, glow: 1 },
      { t: 2.017, black: 0, thr: 0.45, rate: 0 },
      { t: 2.083, thr: -1, rate: 1, clip: 0.2, mix: 0.45, glow: 0.6 },
      { t: 2.15, mix: 0.75 },
      { t: 2.183, mix: 1, glow: 0.6 },
      { t: 2.35, glow: 0 },
    ],
  },
  {
    // Angela, top row. The clip, white with black specks at 2.12, white with black bars, then a
    // pale ghost on the way to the splash.
    slug: "angela",
    beats: [
      { t: 2.017, grow: 0.3, top: 1, mix: 0, clip: 0, rate: 1, step: 20, glow: 0.4, seed: 4 },
      { t: 2.05, grow: 0.7 },
      { t: 2.083, grow: 1 },
      { t: 2.117, thr: 0.62, rate: 0, glow: 1 },
      { t: 2.183, thr: 0.7 },
      { t: 2.283, thr: -1, mix: 0.55, white: 0.3, rate: 1, clip: 0.4 },
      { t: 2.4, white: 0, mix: 0.85, glow: 0.4 },
      { t: 2.5, mix: 1, glow: 0 },
    ],
  },
  {
    // Lesley, tall, opens down from the top. Orange with the rainbow edge (2.15 to 2.3), a white
    // then black impact with a silhouette (2.32 to 2.38), a ghost, the splash at 2.48.
    slug: "lesley",
    beats: [
      {
        t: 2.15,
        grow: 0.15,
        top: 1,
        mix: 0,
        clip: 0,
        rate: 1,
        step: 20,
        fringe: 1,
        glow: 0.4,
        seed: 5,
      },
      { t: 2.183, grow: 0.6 },
      { t: 2.217, grow: 1 },
      { t: 2.283, fringe: 0.6, white: 0.3, glow: 0.8 },
      { t: 2.317, thr: 0.6, white: 0, fringe: 0, rate: 0, glow: 1 },
      { t: 2.35, inv: 1 },
      { t: 2.383, thr: -1, inv: 0, black: 0.85, mix: 0.6 },
      { t: 2.45, black: 0.5, mix: 0.8 },
      { t: 2.483, black: 0, mix: 1, white: 0.3, glow: 0.8 },
      { t: 2.517, white: 0 },
      { t: 2.7, glow: 0 },
    ],
  },
  {
    // Guinevere, bottom row, the big one. White at 2.33, a black panel with the prism flare that
    // flickers with white until 2.6, a ghost at 2.62, the splash at 2.65.
    slug: "guinevere",
    beats: [
      { t: 2.33, grow: 0.2, mix: 0, clip: 0, rate: 1, step: 20, white: 1, glow: 1, seed: 6 },
      { t: 2.35, grow: 1 },
      { t: 2.383, white: 0.85 },
      { t: 2.417, white: 0, black: 1, flare: 0.4, rate: 0 },
      { t: 2.45, flare: 0.6 },
      { t: 2.483, white: 1, black: 0, flare: 0 },
      { t: 2.517, white: 0, black: 1, flare: 0.8 },
      { t: 2.55, flare: 1 },
      { t: 2.583, flare: 1.2 },
      { t: 2.617, black: 0, flare: 0, mix: 0.45, rate: 1, clip: 0.5, glow: 0.8 },
      { t: 2.65, mix: 1, glow: 1 },
      { t: 2.72, glow: 0.3 },
    ],
  },
  {
    // Vexana, top row. A white strip, black with the prism flare, pink and white at 2.62.
    slug: "vexana",
    beats: [
      {
        t: 2.483,
        grow: 0.3,
        top: 1,
        mix: 0,
        clip: 0,
        rate: 1,
        step: 20,
        white: 1,
        glow: 1,
        seed: 7,
      },
      { t: 2.517, grow: 1, white: 0, black: 1, flare: 1, rate: 0 },
      { t: 2.6, flare: 0.8 },
      { t: 2.617, black: 0, flare: 0, white: 0.45, rate: 1, clip: 0.3 },
      { t: 2.65, white: 0.6 },
      { t: 2.683, white: 1, glow: 0.8 },
      { t: 2.8, stripes: 1 },
      { t: 2.883, stripes: 0 },
    ],
  },
  {
    // Selena, tall, the last one, at the left: a black strip, white, a black and white split.
    slug: "selena",
    beats: [
      { t: 2.6, grow: 0.03, mix: 0, clip: 0, rate: 1, step: 20, black: 1, glow: 0.6, seed: 8 },
      { t: 2.65, grow: 0.1, black: 0, white: 1, glow: 1 },
      { t: 2.683, grow: 0.2 },
      { t: 2.717, grow: 0.75, white: 0, split: 0.55, rate: 0 },
      { t: 2.75, grow: 1 },
      { t: 2.8, stripes: 1, split: -1 },
      { t: 2.883, stripes: 0 },
    ],
  },
  {
    // Obsidia, on the real page, in the box of her own panel. When the glass breaks she is white-hot
    // with a rainbow edge, then her welcome clip plays, then her splash comes in, and the panel is
    // let go at the end so the page's own frame and name show (4.2 s).
    slug: "obsidia",
    beats: [
      {
        t: 3.2,
        grow: 1,
        page: 1,
        mix: 0,
        clip: 0,
        rate: 1,
        step: 60,
        white: 1,
        glow: 1,
        fringe: 1,
        seed: 9,
      },
      { t: 3.233, white: 0.6 },
      { t: 3.267, white: 0.25 },
      { t: 3.3, white: 0, fringe: 0.6, glow: 0.6 },
      { t: 3.4, fringe: 0, glow: 0.35 },
      { t: 3.9, mix: 0, alpha: 1, lerp: true },
      { t: 4.05, mix: 1, glow: 0, lerp: true },
      { t: 4.2, alpha: 0 },
    ],
  },
];
