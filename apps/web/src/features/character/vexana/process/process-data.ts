/** What the 3D process section says about the video: its passes, read from the video itself. */

export interface Pass {
  id: "clay" | "render" | "fx";
  label: string;
  /** What the pass is, in a line. */
  note: string;
  /** Seconds of the video that belong to the pass. */
  ranges: ReadonlyArray<readonly [number, number]>;
  /** Where a click on the pass jumps to. */
  start: number;
  /** Figures for the properties panel. They are illustrative, written for the page. */
  stats: ReadonlyArray<readonly [string, string]>;
}

/** The clip alternates clay views and final renders, then ends on the effects. */
export const PASSES: readonly Pass[] = [
  {
    id: "clay",
    label: "Clay pass",
    note: "Plain grey. Only shape and silhouette, so every fold has to work without colour.",
    ranges: [
      [0, 5],
      [6, 9],
      [10, 11],
    ],
    start: 0,
    stats: [
      ["Vertices", "184,220"],
      ["Triangles", "362,418"],
      ["Material", "Clay grey"],
    ],
  },
  {
    id: "render",
    label: "Render pass",
    note: "Colour, light and the Ender glow laid over the same model.",
    ranges: [
      [5, 6],
      [9, 10],
      [11, 12],
    ],
    start: 9,
    stats: [
      ["Textures", "4K, 12 maps"],
      ["Lights", "3 rim, 1 key"],
      ["Material", "Painted"],
    ],
  },
  {
    id: "fx",
    label: "Effects",
    note: "Energy, smoke and the last burst. The model hands over to light.",
    ranges: [[12, 16.82]],
    start: 12,
    stats: [
      ["Particles", "12,000"],
      ["Layers", "9"],
      ["Material", "Additive"],
    ],
  },
];

export const SHADES = [
  { id: "render", label: "Render" },
  { id: "wire", label: "Wire" },
  { id: "clay", label: "Clay" },
  { id: "uv", label: "UV" },
] as const;

export type Shade = (typeof SHADES)[number]["id"];

export const TOOLS = ["Select", "Move", "Rotate", "Scale", "Camera"] as const;

/** The video runs at 30 frames a second. */
export const FPS = 30;

export function passAt(t: number): Pass {
  return (
    PASSES.find((p) => p.ranges.some(([a, b]) => t >= a && t < b)) ?? PASSES[PASSES.length - 1]!
  );
}
