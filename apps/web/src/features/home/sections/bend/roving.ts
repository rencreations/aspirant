/**
 * The credit plates as one stop of the tab key. Fifteen plates with two links each were thirty
 * tab stops between "Fan art" and "Artwork"; now the tab key stops once in the list (on the plate
 * last used) and the arrow keys, Home and End move between plates. Pure: the runtime owns the DOM.
 */

/** The keys the list answers to. */
export type RovingKey = "ArrowRight" | "ArrowDown" | "ArrowLeft" | "ArrowUp" | "Home" | "End";

const KEYS: readonly string[] = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];

export function isRovingKey(key: string): key is RovingKey {
  return KEYS.includes(key);
}

/**
 * The plate to move to for a key, or null when the key does not move (the first plate pressed
 * back, the last pressed on). `has[i]` says plate `i` has a link to land on; a plate without one is
 * stepped over. Home and End go to the first and the last plate that has one.
 */
export function rovingNext(key: RovingKey, from: number, has: readonly boolean[]): number | null {
  const n = has.length;
  if (n === 0) return null;
  const dir = key === "ArrowRight" || key === "ArrowDown" ? 1 : -1;
  if (key === "Home" || key === "End") {
    for (let k = 0; k < n; k++) {
      const i = key === "Home" ? k : n - 1 - k;
      if (has[i]) return i === from ? null : i;
    }
    return null;
  }
  for (let i = from + dir; i >= 0 && i < n; i += dir) {
    if (has[i]) return i;
  }
  return null;
}

/** The plate that holds the tab stop: the one asked for if it has a link, else the first that has. */
export function rovingStart(want: number, has: readonly boolean[]): number {
  if (has[want]) return want;
  const first = has.indexOf(true);
  return first < 0 ? 0 : first;
}
