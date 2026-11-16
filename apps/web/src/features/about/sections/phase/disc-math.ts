import type { PhaseTrack } from "./types";

/**
 * The arithmetic of a disc of the music decks: where it leans when the pointer moves, how its
 * printed words are set, how it eases. Plain numbers, so it can be tested.
 */

/** The furthest a disc leans toward the pointer, in degrees. */
export const MAX_TILT = 18;

export interface Tilt {
  /** Degrees about the horizontal axis: positive turns the face up the screen. */
  x: number;
  /** Degrees about the vertical axis: positive turns the face to the right. */
  y: number;
}

/**
 * How a disc leans so that its face looks at the pointer. `dx` and `dy` are the pointer's distance
 * from the disc's centre and `reach` the distance at which the lean is complete, all in pixels.
 * The lean grows with the distance and never passes `max` in any direction.
 */
export function tiltToward(dx: number, dy: number, reach: number, max = MAX_TILT): Tilt {
  if (!(reach > 0)) return { x: 0, y: 0 };
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-6) return { x: 0, y: 0 };
  const lean = Math.min(1, distance / reach) * max;
  // `0 - n` so that a pointer on an axis gives a plain 0 and never a negative zero.
  return { x: 0 - (dy / distance) * lean, y: (dx / distance) * lean };
}

/**
 * One step of an ease toward a target that does not depend on the frame rate: after `halfLife`
 * milliseconds half of the way is done.
 */
export function approach(current: number, target: number, dtMs: number, halfLife: number): number {
  if (!(halfLife > 0)) return target;
  return target + (current - target) * Math.pow(0.5, Math.max(0, dtMs) / halfLife);
}

/** The words that run round the rim of a disc, as on the discs of the Music room. */
export function rimWords(track: PhaseTrack): string {
  const parts = [
    "The Aspirants",
    track.ep,
    track.title,
    ...track.credits.map((credit) => `${credit.role} ${credit.name}`),
    track.released,
    "Music collection",
  ].filter(Boolean);
  return `${parts.join("  ·  ").toUpperCase()}  ·  `;
}

/**
 * The rim words repeated until they fill the ring: `room` is how many characters the ring holds.
 * Whole repeats only, so the ring never ends in the middle of a word, and at least one.
 */
export function fillRing(words: string, room: number): string {
  if (words.length === 0) return "";
  return words.repeat(Math.max(1, Math.round(room / words.length)));
}

/** A title on a disc: at most two lines of near equal length, in capitals. */
export function titleLines(title: string): string[] {
  const words = title.toUpperCase().split(/\s+/u).filter(Boolean);
  if (words.length < 3 || title.length <= 16) return [words.join(" ")];
  let best = 1;
  let score = Infinity;
  for (let k = 1; k < words.length; k += 1) {
    const a = words.slice(0, k).join(" ").length;
    const b = words.slice(k).join(" ").length;
    const s = Math.abs(a - b);
    if (s < score) {
      score = s;
      best = k;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

/**
 * The size of the title on a disc, in the units of its drawing (the disc is 1000 across). The
 * display face is narrow: a capital takes about `0.47` of the size. The longest line must fit
 * `room`, and the size stays between 44 and 96.
 */
export function titleSize(lines: readonly string[], room: number): number {
  const longest = Math.max(1, ...lines.map((line) => line.length));
  return Math.round(Math.min(96, Math.max(44, room / (longest * 0.47))));
}

/** The disc's turn while its track plays: once in four seconds. At rest it turns ten times slower. */
export const SPIN_MS = 4000;
export const REST_RATE = 0.1;
