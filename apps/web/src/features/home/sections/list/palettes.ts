/**
 * The colours of the live backdrop behind the list, one set for each frame, in the order of the
 * strip (`frames.ts`: nine pictures, then Selena). Each is four stops from dark to light, taken from
 * the dominant colours of the frame's picture (looked at on the real frames, then made a little
 * deeper and brighter so they glow on the dark ground). Kept apart from `frames.ts`, which a test
 * holds equal to the media workstream's data.
 */
export const FRAME_PALETTES: ReadonlyArray<readonly string[]> = [
  // Obsidia: rose and wine
  ["#2a0a1c", "#8f334a", "#da5c82", "#ffb3c1"],
  // Fanny: blue sky and an orange flash
  ["#0d1a3d", "#2f4fb0", "#7aa0ff", "#ff9a7a"],
  // Guinevere: lavender and wine
  ["#1a1030", "#99404d", "#7c84bb", "#f0b4c8"],
  // Angela: violet dusk and pink
  ["#241638", "#5d4a86", "#8fa8e0", "#ff9aa8"],
  // Lesley: warm sand and dark
  ["#1d1416", "#7a5a4a", "#d9a37a", "#ffe0bc"],
  // Layla: blue and pink
  ["#101a38", "#3a58b0", "#6f93e8", "#ff9fb4"],
  // Ruby: deep blue and a copper edge
  ["#08203f", "#1d589e", "#5ea0ff", "#d9a070"],
  // Vexana: purple
  ["#1a0b2a", "#53307a", "#9a58d6", "#d6a0ff"],
  // Chang'e: moon blue and orchid
  ["#10162e", "#4a5a96", "#8fb0ff", "#e08af0"],
  // Selena: dusk blue and a rose edge (the sky she is drawn on)
  ["#0c1230", "#3c3b6b", "#8fa3e0", "#f0a8a0"],
];
