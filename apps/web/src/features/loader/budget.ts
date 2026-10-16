import { DPR_CAP, WORD_SHARE, WORD_SHARE_SMALL } from "./constants";

export interface Viewport {
  width: number;
  height: number;
  /** Touch-first device (pointer: coarse). */
  coarse: boolean;
  /** navigator.hardwareConcurrency, or 0 when unknown. */
  cores: number;
}

/** Particles per CSS pixel of viewport area. 1440x900 lands near 10k. */
const DENSITY = 0.0078;

/**
 * How many particles the title gets. Desktop sits between 5k and 12k by area, phones stay
 * near 3k, tablets in between. Weak CPUs get a quarter fewer.
 */
export function particleBudget({ width, height, coarse, cores }: Viewport): number {
  const area = Math.max(0, width) * Math.max(0, height);
  const shortSide = Math.min(width, height);
  let min = 5000;
  let max = 12000;
  if (coarse && shortSide < 600) {
    min = 3200;
    max = 3600;
  } else if (coarse) {
    min = 3600;
    max = 7000;
  }
  let count = Math.min(max, Math.max(min, area * DENSITY));
  if (cores > 0 && cores <= 4) count *= 0.75;
  return Math.round(count);
}

/** Most canvas pixels we draw per frame; above this the fill rate, not the particles, costs. */
const PIXEL_BUDGET = 6_000_000;

/**
 * Device pixel ratio for the canvas: capped at 2 (1.5 on weak CPUs) and held under a pixel
 * budget so 4K and ultrawide screens do not clear and composite tens of megapixels a frame.
 */
export function canvasDpr(
  devicePixelRatio: number,
  cores: number,
  width: number,
  height: number,
): number {
  const cap = cores > 0 && cores <= 4 ? 1.5 : DPR_CAP;
  const dpr = Math.min(cap, Math.max(1, devicePixelRatio || 1));
  const area = Math.max(1, width * height);
  return Math.max(0.75, Math.min(dpr, Math.sqrt(PIXEL_BUDGET / area)));
}

/** Share of the budget that builds the wordmark: higher when the budget is small. */
export function wordShare(count: number): number {
  return count < 4000 ? WORD_SHARE_SMALL : WORD_SHARE;
}
