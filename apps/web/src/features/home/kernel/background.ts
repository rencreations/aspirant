/**
 * The ground behind the page: two stacked layers (the daybreak paper with its dot grid, the storm
 * night) and a third that holds a plain colour for a section that wants one. They cross-fade by
 * opacity at the joints between sections, driven by the position on the scroll (the upper layer
 * fades over the lower one, which stays whole). Nothing is written
 * to `<html>` or `<body>`: only the three layers' own opacity and the colour layer's own colour.
 */
import { sectionAt, type Layout } from "./layout";
import type { GroundName } from "./types";

/** The scroll distance, in screens, over which two grounds cross at a joint (centred on it). */
export const GROUND_FADE = 0.5;

/** The colour of the storm ground (`--bg` of the storm theme). */
export const STORM_HEX = "#05070c";

export interface GroundMix {
  /** Opacity of the daybreak layer, 0 to 1. */
  readonly daybreak: number;
  /** Opacity of the storm layer. */
  readonly storm: number;
  /** Opacity of the colour layer. */
  readonly colour: number;
  /** The colour (`#rrggbb`) the colour layer shows. */
  readonly colourHex: string;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  const v = m ? parseInt(m[1]!, 16) : 0;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgbToHex(rgb: readonly [number, number, number]): string {
  const part = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(rgb[0])}${part(rgb[1])}${part(rgb[2])}`;
}

/** Linear mix of two `#rrggbb` colours. */
export function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

function single(ground: GroundName): GroundMix {
  if (ground === "daybreak") return { daybreak: 1, storm: 0, colour: 0, colourHex: STORM_HEX };
  if (ground === "storm") return { daybreak: 0, storm: 1, colour: 0, colourHex: STORM_HEX };
  return { daybreak: 0, storm: 0, colour: 1, colourHex: ground };
}

/** The stacking of the three layers, bottom to top (the order of the elements in the stage). */
function layerOf(mix: GroundMix): 0 | 1 | 2 {
  return mix.colour > 0 ? 2 : mix.storm > 0 ? 1 : 0;
}

/**
 * Blend two single grounds: `t` of 0 is `a`, 1 is `b`. The layers are stacked, so only the upper
 * of the two fades and the lower one stays whole: two opaque layers that fade against each other
 * both show the page behind them in the middle (a grey wash on a dark to dark joint).
 */
function blend(a: GroundMix, b: GroundMix, t: number): GroundMix {
  const ra = layerOf(a);
  const rb = layerOf(b);
  let colourHex = a.colour > 0 ? a.colourHex : b.colourHex;
  if (a.colour > 0 && b.colour > 0) colourHex = mixHex(a.colourHex, b.colourHex, t);
  // The weight of each layer: the lower stays at 1, the upper takes t (coming in) or 1 - t (going out).
  const weight = [0, 0, 0];
  if (ra === rb) {
    weight[ra] = 1;
  } else if (rb > ra) {
    weight[ra] = 1;
    weight[rb] = t;
  } else {
    weight[rb] = 1;
    weight[ra] = 1 - t;
  }
  return { daybreak: weight[0]!, storm: weight[1]!, colour: weight[2]!, colourHex };
}

/**
 * The ground at a scroll position. Inside a section it is the section's own ground; around the
 * joint with a neighbour it crosses over `GROUND_FADE` screens centred on the joint.
 */
export function groundAt(layout: Layout, S: number): GroundMix {
  const here = sectionAt(layout, S);
  const list = layout.placed;
  const half = GROUND_FADE / 2;

  const next = list[here.index + 1];
  if (next && S > next.start - half && next.def.bg !== here.def.bg) {
    const t = clamp01((S - (next.start - half)) / GROUND_FADE);
    return blend(single(here.def.bg), single(next.def.bg), t);
  }
  const before = list[here.index - 1];
  if (before && S < here.start + half && before.def.bg !== here.def.bg) {
    const t = clamp01((S - (here.start - half)) / GROUND_FADE);
    return blend(single(before.def.bg), single(here.def.bg), t);
  }
  return single(here.def.bg);
}

/** The three layers of the ground. */
export interface GroundLayers {
  readonly daybreak: HTMLElement;
  readonly storm: HTMLElement;
  readonly colour: HTMLElement;
}

/** Writes a ground mix to its layers, only when something changed enough to see. */
export class Background {
  private last = { d: -1, s: -1, c: -1, hex: "" };

  constructor(private readonly layers: GroundLayers) {}

  apply(mix: GroundMix): void {
    const l = this.last;
    if (Math.abs(mix.daybreak - l.d) > 0.002 || (mix.daybreak === 0) !== (l.d === 0)) {
      l.d = mix.daybreak;
      this.layers.daybreak.style.opacity = String(Number(mix.daybreak.toFixed(3)));
    }
    if (Math.abs(mix.storm - l.s) > 0.002 || (mix.storm === 0) !== (l.s === 0)) {
      l.s = mix.storm;
      this.layers.storm.style.opacity = String(Number(mix.storm.toFixed(3)));
    }
    if (mix.colourHex !== l.hex && mix.colour > 0) {
      l.hex = mix.colourHex;
      this.layers.colour.style.backgroundColor = mix.colourHex;
    }
    if (Math.abs(mix.colour - l.c) > 0.002 || (mix.colour === 0) !== (l.c === 0)) {
      l.c = mix.colour;
      this.layers.colour.style.opacity = String(Number(mix.colour.toFixed(3)));
    }
  }
}
