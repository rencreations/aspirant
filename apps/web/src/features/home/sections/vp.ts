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

/** The character spread needs room for both the cast and the left copy column. */
const SELENA_WIDE = "(min-width: 900px) and (orientation: landscape)";

export function wideSelena(vp: Vp): boolean {
  return vp.w >= 900 && vp.w > vp.h;
}

/** Build the shared cast on the first wide layout, including after rotation. */
export function onWideSelena(start: () => void): () => void {
  const media = matchMedia(SELENA_WIDE);
  const check = () => {
    if (!media.matches) return;
    media.removeEventListener("change", check);
    start();
  };
  media.addEventListener("change", check);
  check();
  return () => media.removeEventListener("change", check);
}

export function preloadSelenaCast(): boolean {
  return typeof matchMedia !== "function" || matchMedia(SELENA_WIDE).matches;
}
