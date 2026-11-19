/**
 * The numbers a backdrop layer is drawn with, and the arithmetic around them: smoothing toward what
 * a section asked for, the size of the drawing buffer, the amount that calms a kind. Pure.
 */
import type { BackdropPalette } from "./palettes";
import { fillStops, parseColor, parseColors, type RGB } from "./colors";

export interface Params {
  /** 0 to 1: the opacity of the kind (calms it over text). */
  amount: number;
  speed: number;
  scale: number;
  intensity: number;
  /** Radians. */
  angle: number;
  seed: number;
  /** The four colour stops, rgb each, raw sRGB. */
  readonly stops: Float32Array;
  /** The highlight colour, rgb. */
  readonly ink: Float32Array;
  /** Four numbers a kind may read as `uX` for what only it needs (the ink field's film glow). */
  readonly extras: Float32Array;
}

export function makeParams(): Params {
  return {
    amount: 1,
    speed: 1,
    scale: 1,
    intensity: 1,
    angle: 0,
    seed: 0,
    stops: new Float32Array(12),
    ink: new Float32Array([1, 1, 1]),
    extras: new Float32Array(4),
  };
}

export function copyParams(to: Params, from: Params): void {
  to.amount = from.amount;
  to.speed = from.speed;
  to.scale = from.scale;
  to.intensity = from.intensity;
  to.angle = from.angle;
  to.seed = from.seed;
  to.stops.set(from.stops);
  to.ink.set(from.ink);
  to.extras.set(from.extras);
}

/** The step of an exponential approach that is the same at 60 and at 144 frames a second. */
export function approachK(dt: number, rate: number): number {
  return dt > 0 ? 1 - Math.exp(-rate * dt) : 0;
}

/** Move `cur` a fraction `k` of the way to `tgt`, every number and every colour. */
export function approachParams(cur: Params, tgt: Params, k: number): void {
  cur.amount += (tgt.amount - cur.amount) * k;
  cur.speed += (tgt.speed - cur.speed) * k;
  cur.scale += (tgt.scale - cur.scale) * k;
  cur.intensity += (tgt.intensity - cur.intensity) * k;
  cur.angle += (tgt.angle - cur.angle) * k;
  cur.seed = tgt.seed;
  for (let i = 0; i < 12; i++) cur.stops[i]! += (tgt.stops[i]! - cur.stops[i]!) * k;
  for (let i = 0; i < 3; i++) cur.ink[i]! += (tgt.ink[i]! - cur.ink[i]!) * k;
  for (let i = 0; i < 4; i++) cur.extras[i]! += (tgt.extras[i]! - cur.extras[i]!) * k;
}

/** Write one to four colours as the four stops of `to`. */
function writeStops(to: Float32Array, colors: readonly RGB[]): void {
  const stops = fillStops(colors);
  for (let s = 0; s < 4; s++) {
    to[s * 3] = stops[s]![0];
    to[s * 3 + 1] = stops[s]![1];
    to[s * 3 + 2] = stops[s]![2];
  }
}

const WHITE: RGB = [1, 1, 1];

/** Write the palette's colours and ink into `to`; css that does not parse keeps the palette's own. */
export function writePalette(
  to: Params,
  palette: BackdropPalette,
  colors: readonly string[] | undefined,
  ink: string | undefined,
): void {
  const base = parseColors(palette.colors, [WHITE]);
  writeStops(to.stops, colors ? parseColors(colors, base) : base);
  const inkRgb = parseColor(ink ?? palette.ink) ?? parseColor(palette.ink) ?? WHITE;
  to.ink[0] = inkRgb[0];
  to.ink[1] = inkRgb[1];
  to.ink[2] = inkRgb[2];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface NumberOptions {
  amount?: number;
  speed?: number;
  scale?: number;
  intensity?: number;
  /** Degrees. */
  angle?: number;
  seed?: number;
  /** Up to four numbers for a kind that reads `uX` (the ink field: film glow, half width, half height). */
  extras?: readonly number[];
}

/** Write the numbers a section gave (or the kind's and the palette's defaults) into `to`. */
export function writeNumbers(
  to: Params,
  defaults: { speed: number; scale: number; angle: number },
  paletteIntensity: number,
  o: NumberOptions,
): void {
  to.amount = clamp01(o.amount ?? 1);
  to.speed = Math.max(0, o.speed ?? defaults.speed);
  to.scale = Math.min(8, Math.max(0.1, o.scale ?? defaults.scale));
  to.intensity = Math.max(0, (o.intensity ?? 1) * paletteIntensity);
  to.angle = ((o.angle ?? defaults.angle) * Math.PI) / 180;
  to.seed = o.seed ?? 0;
  for (let i = 0; i < 4; i++) to.extras[i] = o.extras?.[i] ?? 0;
}

/** The most pixels the drawing buffer may hold. A backdrop is soft, so this is far under the stage's. */
export const BUFFER_BUDGET = 2.4e6;

/** The buffer's scale for a kind that asks for `res` on a display of ratio `dpr`. */
export function bufferScaleFor(res: number, dpr: number): number {
  return Math.max(0.25, Math.min(res, dpr > 0 ? dpr : 1));
}

/** The buffer's size in pixels for a canvas of `w` by `h` CSS pixels, within the budget. */
export function bufferSize(w: number, h: number, scale: number): { w: number; h: number } {
  const cssW = Math.max(1, w);
  const cssH = Math.max(1, h);
  const fit = Math.min(1, Math.sqrt(BUFFER_BUDGET / (cssW * cssH * scale * scale)));
  const s = scale * fit;
  return { w: Math.max(2, Math.round(cssW * s)), h: Math.max(2, Math.round(cssH * s)) };
}
