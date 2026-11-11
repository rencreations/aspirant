/**
 * Which pictures matter first. The entrance starts three places down and glides to the first
 * picture, and the loop shows the last picture as the one before at the top, so the places -1, 0, 1,
 * 2 and 3 around the start are waited for. The others come in the background, nearest first.
 */
import { mod } from "./model";

/** The index `?i=<id>` names in `items`, or 0. */
export function startIndex(search: string, items: ReadonlyArray<{ id: string }>): number {
  const id = new URLSearchParams(search).get("i");
  if (!id) return 0;
  const at = items.findIndex((item) => item.id === id);
  return at < 0 ? 0 : at;
}

/** The pictures of the first screen: the places -1 to 3 around `start`, without repeats. */
export function firstPlaces(start: number, n: number): number[] {
  const out: number[] = [];
  for (let j = -1; j <= 3; j += 1) {
    const k = mod(start + j, n);
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

/**
 * Every other picture in the order they are likely to be needed: the one after the first screen,
 * then the one before it, and on outwards round the loop. The first screen is left out.
 */
export function laterPlaces(start: number, n: number): number[] {
  const skip = new Set(firstPlaces(start, n));
  const out: number[] = [];
  for (let i = 0; i < n && out.length + skip.size < n; i += 1) {
    for (const j of [4 + i, -2 - i]) {
      const k = mod(start + j, n);
      if (!skip.has(k) && !out.includes(k)) out.push(k);
    }
  }
  return out;
}
