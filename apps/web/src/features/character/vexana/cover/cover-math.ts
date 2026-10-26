/**
 * The scale the interlude's panel starts at when it first shows at the bottom of the screen: a
 * clear padding of 7 percent on each side that fills as it rises.
 */
export const RISE_START_SCALE = 0.86;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The scale of the panel at a progress of the rise (0 when its top edge is at the bottom of the
 * screen, 1 when it covers the screen). It grows from `RISE_START_SCALE` to 1 along a smooth
 * curve, about the top middle of the panel, so the padding at the sides fills by itself and the
 * picture looks as if it expands and zooms. The panel's bottom edge is `scale` screens below its
 * top edge, and its top edge is `1 - p` screens down, so it never leaves the bottom of the screen
 * uncovered while `scale >= p`, which this curve keeps.
 */
export function riseScale(p: number): number {
  const q = clamp01(p);
  const e = q * q * (3 - 2 * q);
  return RISE_START_SCALE + (1 - RISE_START_SCALE) * e;
}

/**
 * The radius of the panel's top corners at a progress of the rise, for a full radius `full`: it
 * changes slowly at first and quickly later, and is square from 60 percent of the way, so when the
 * panel has come all the way it covers the whole screen with no corner and no gap.
 */
export function riseRadius(p: number, full: number): number {
  if (p >= 0.6) return 0;
  const q = clamp01(p / 0.6);
  return full * (1 - q * q * q);
}
