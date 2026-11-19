/**
 * The few pure helpers the sections after the strip share: the screen's kind and the usual blend
 * curves. They lived with the hand section until round six deleted it. No imports.
 */
export interface Vp {
  readonly w: number;
  readonly h: number;
}

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
/** 0 before `a`, 1 after `b`, linear between. */
export const seg = (v: number, a: number, b: number): number => clamp01((v - a) / (b - a));
export const smooth = (u: number): number => u * u * (3 - 2 * u);
export const mix = (a: number, b: number, u: number): number => a + (b - a) * u;

/** A phone held upright. */
export function isPortrait(vp: Vp): boolean {
  return vp.w < vp.h * 0.75;
}
