/** Pure helpers for the reading room (kept apart so they can be tested). */

export function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * How far through the text the reader is: 0 when the top of the text is a third of the screen
 * down, 1 when its end has come up to that line.
 */
export function readProgress(top: number, height: number, viewport: number): number {
  if (height <= 0) return 0;
  return clamp01((viewport * 0.3 - top) / height);
}

/** The last heading whose top has passed `line` (a y position in the viewport). Null before the first. */
export function activeIndex(tops: readonly number[], line: number): number {
  let active = -1;
  for (let i = 0; i < tops.length; i += 1) {
    const top = tops[i];
    if (top !== undefined && top <= line) active = i;
  }
  return active;
}

/** Minutes left to read, at least 0, from the total and the progress. */
export function minutesLeft(total: number, progress: number): number {
  return Math.max(0, Math.ceil(total * (1 - progress)));
}
