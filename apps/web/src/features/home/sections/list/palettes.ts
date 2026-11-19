/**
 * The colours of the live backdrop behind the list, one set for each frame, in the order of the
 * strip (`frames.ts`: nine pictures, then Selena). The home is light only (round five), so each is
 * four pastel stops taken from the dominant colours of the frame's picture and lightened toward the
 * paper: a pale tint, the picture's main hue, its deeper hue and a pale edge. Kept apart from
 * `frames.ts`, which a test holds equal to the media workstream's data.
 */
export const FRAME_PALETTES: ReadonlyArray<readonly string[]> = [
  // Obsidia: rose and wine
  ["#ffd1da", "#ecaec0", "#e17998", "#ffe2e7"],
  // Fanny: blue sky and an orange flash
  ["#ffc2af", "#bcd0ff", "#92b1ff", "#ffd9cc"],
  // Guinevere: lavender and wine
  ["#f6d2de", "#bec2dd", "#949ac7", "#f9e2ea"],
  // Angela: violet dusk and pink
  ["#ffc2cb", "#c7d4f0", "#a3b8e6", "#ffd9de"],
  // Lesley: warm sand
  ["#ffecd7", "#ecd1bc", "#e0b492", "#fff3e6"],
  // Layla: blue and pink
  ["#ffc5d2", "#b7c9f4", "#89a6ec", "#ffdbe2"],
  // Ruby: sky blue and a copper edge
  ["#e8c6a9", "#aed0ff", "#7bb1ff", "#f1dbc9"],
  // Vexana: purple
  ["#e6c6ff", "#ccacea", "#ac76dd", "#efdbff"],
  // Chang'e: moon blue and orchid
  ["#ecb9f6", "#c7d8ff", "#a3beff", "#f3d3f9"],
  // Selena: dusk blue and a rose edge (the sky she is drawn on)
  ["#f6cbc6", "#c7d1f0", "#a3b4e6", "#f9dedb"],
];
