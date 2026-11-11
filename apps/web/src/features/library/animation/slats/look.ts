/**
 * The look of the slat field (a TypeScript port of React Bits' MicroSlats, see `engine.ts`): its
 * colours, its sea and its slats, and the pure maths that blends one look into another and sizes
 * the slats for a screen. Nothing here touches the page.
 */

/** The four starting seas of MicroSlats. */
export type SeaPreset = "swell" | "tide" | "storm" | "signal";

/** The sea: how the swell rolls and how the light sits on it. */
export interface Sea {
  /** Size of the swell. Larger is longer, calmer waves. */
  scale: number;
  /** How fast the waves roll. */
  speed: number;
  /** Heading of the swell in degrees. 270 rolls straight at the viewer. */
  direction: number;
  /** Sharp crests and flat troughs. */
  chop: number;
  /** How much a slat grows and shrinks with the wave under it. */
  stretch: number;
  /** Light caught on the crests. */
  glint: number;
  /** Spread between dark troughs and bright crests. */
  contrast: number;
  /** How far the sea recedes towards a horizon above the top edge. 0 is a flat wall. */
  perspective: number;
  /** Haze over the far rows. */
  fog: number;
}

/** The values of MicroSlats' presets, as published. */
export const SEAS: Readonly<Record<SeaPreset, Sea>> = {
  swell: {
    scale: 1.5,
    speed: 0.6,
    direction: 250,
    chop: 0.55,
    stretch: 0,
    glint: 0.7,
    contrast: 1.25,
    perspective: 0.55,
    fog: 0.55,
  },
  tide: {
    scale: 1.3,
    speed: 0.5,
    direction: 262,
    chop: 0.2,
    stretch: 0.12,
    glint: 0.45,
    contrast: 1.1,
    perspective: 0.5,
    fog: 0.4,
  },
  storm: {
    scale: 0.55,
    speed: 1.6,
    direction: 236,
    chop: 1,
    stretch: 0.3,
    glint: 1.3,
    contrast: 1.8,
    perspective: 0.8,
    fog: 0.35,
  },
  signal: {
    scale: 0.85,
    speed: 1.2,
    direction: 180,
    chop: 0.6,
    stretch: 0.85,
    glint: 0.25,
    contrast: 1.2,
    perspective: 0,
    fog: 0,
  },
};

/** One full look of the field. Sizes are CSS pixels on a screen whose short side is 900. */
export interface SlatsLook {
  /** The slats. */
  color: string;
  /** What the slats turn to on the crests and in the cursor's light. */
  glint: string;
  /** Behind the slats. */
  ground: string;
  sea: Sea;
  slatWidth: number;
  slatHeight: number;
  gap: number;
  /** Square at 0, a full pill at 1. */
  roundness: number;
}

type Rgb = readonly [number, number, number];

/** `#rrggbb` as three channels from 0 to 1. */
export function hexRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function rgbHex(c: Rgb): string {
  return `#${c
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, v)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Colours blend channel by channel. */
function mixColor(a: string, b: string, t: number): string {
  const x = hexRgb(a);
  const y = hexRgb(b);
  return rgbHex([mix(x[0], y[0], t), mix(x[1], y[1], t), mix(x[2], y[2], t)]);
}

/** A heading blends the short way round: 350 to 10 passes 0, not 180. */
export function mixAngle(a: number, b: number, t: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return (((a + d * t) % 360) + 360) % 360;
}

/** The look `t` of the way from `a` to `b` (0 is `a`, 1 is `b`). */
export function mixLook(a: SlatsLook, b: SlatsLook, t: number): SlatsLook {
  const k = Math.min(1, Math.max(0, t));
  return {
    color: mixColor(a.color, b.color, k),
    glint: mixColor(a.glint, b.glint, k),
    ground: mixColor(a.ground, b.ground, k),
    sea: {
      scale: mix(a.sea.scale, b.sea.scale, k),
      speed: mix(a.sea.speed, b.sea.speed, k),
      direction: mixAngle(a.sea.direction, b.sea.direction, k),
      chop: mix(a.sea.chop, b.sea.chop, k),
      stretch: mix(a.sea.stretch, b.sea.stretch, k),
      glint: mix(a.sea.glint, b.sea.glint, k),
      contrast: mix(a.sea.contrast, b.sea.contrast, k),
      perspective: mix(a.sea.perspective, b.sea.perspective, k),
      fog: mix(a.sea.fog, b.sea.fog, k),
    },
    slatWidth: mix(a.slatWidth, b.slatWidth, k),
    slatHeight: mix(a.slatHeight, b.slatHeight, k),
    gap: mix(a.gap, b.gap, k),
    roundness: mix(a.roundness, b.roundness, k),
  };
}

/** The ease of a change of look: slow out, slow in. */
export function easeLook(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
}

/** The ease of the front of a new look: it leaves at once and slows as it reaches the viewer. */
export function easeWash(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return 1 - (1 - k) ** 3;
}

/**
 * How much the slats are scaled for a screen. The looks are drawn for a short side of 900 pixels: a
 * phone gets smaller slats so its field still reads as a field of many (about forty across a 390
 * wide phone), a big screen gets slightly larger ones so it is not a grey haze of thousands.
 */
export function slatScale(view: { w: number; h: number }): number {
  const short = Math.max(1, Math.min(view.w, view.h));
  return Math.min(1.3, Math.max(0.62, short / 900));
}

/**
 * The size of the drawing buffer: the screen's own pixel ratio, at most 2, and at most `budget`
 * pixels in all, so the cost of a frame has a ceiling on every screen. The same rule for every
 * device: it depends only on the size of the screen and its pixel ratio.
 */
export function bufferRatio(view: { w: number; h: number }, dpr: number, budget: number): number {
  const area = Math.max(1, view.w * view.h);
  return Math.max(0.5, Math.min(dpr || 1, 2, Math.sqrt(budget / area)));
}
