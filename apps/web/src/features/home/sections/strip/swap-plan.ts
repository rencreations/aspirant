/**
 * The schedule of a word that changes letter by letter (the owner's words, 19 Nov: when a button is
 * hovered the new word must not appear all at once; "TRAILER" has 7 letters and adds one letter at a
 * time, at random, smoothly). Pure: a function of the two words and a seed, so a frozen frame is the
 * same every time and the arithmetic is tested.
 *
 * A word is laid out as `slots`, one for each place of a letter. In a slot the old word's letter
 * leaves and the new word's letter comes in a moment later, so the new word is built one letter at a
 * time, in no order, and the old one is taken down the same way. A slot with a space in both words
 * costs no time.
 */
import { letterMoment } from "./journey";

/** The seconds the slots are spread over when the word has a natural pace (the owner: about 0.35 s). */
const SWAP_TOTAL = 0.35;
/** The least and the most time between two slots, seconds (40 to 60 ms for a word of seven). */
export const STEP_MIN = 0.03;
export const STEP_MAX = 0.06;
/** One letter's own fade, seconds: a letter is never a snap. */
export const SWAP_FADE = 0.1;
/** The new letter starts this share of a fade after the old one in the same slot (a short crossing). */
export const CROSS = 0.4;

/** A random order of `0..n-1` from a seed (a Fisher and Yates shuffle on a fixed hash). */
export function shuffled(n: number, seed: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(letterMoment(i, seed) * (i + 1)));
    const t = order[i]!;
    order[i] = order[j]!;
    order[j] = t;
  }
  return order;
}

const isGlyph = (c: string | undefined): boolean => c !== undefined && c.trim() !== "";

export interface SwapPlan {
  /** For each letter of the old word, the second it begins to leave (-1: a space, nothing to do). */
  out: number[];
  /** For each letter of the new word, the second it begins to come in (-1: a space). */
  in: number[];
  /** The time the last letter is done, seconds. */
  duration: number;
}

/** The time between two slots for a word with `slots` visible places: 0.35 s in all, within 30 to 60 ms. */
export function slotStep(slots: number): number {
  if (slots <= 0) return STEP_MAX;
  return Math.min(STEP_MAX, Math.max(STEP_MIN, SWAP_TOTAL / slots));
}

/** When each letter of `from` leaves and each letter of `to` comes in. */
export function swapPlan(from: string, to: string, seed: number): SwapPlan {
  const n = Math.max(from.length, to.length);
  const slots: number[] = [];
  for (let i = 0; i < n; i++) if (isGlyph(from[i]) || isGlyph(to[i])) slots.push(i);
  const step = slotStep(slots.length);
  const order = shuffled(slots.length, seed);
  const at = new Map<number, number>();
  order.forEach((slot, k) => at.set(slots[slot]!, k * step));
  const out = Array.from(from, (c, i) => (isGlyph(c) ? at.get(i)! : -1));
  const inn = Array.from(to, (c, i) => (isGlyph(c) ? at.get(i)! + SWAP_FADE * CROSS : -1));
  const last = Math.max(0, ...out, ...inn);
  return { out, in: inn, duration: slots.length === 0 ? 0 : last + SWAP_FADE };
}

/** A letter's opacity at `t` seconds: it starts at `value`, begins its fade at `start` and ends on `target`. */
export function letterValue(value: number, target: number, start: number, t: number): number {
  if (start < 0) return target;
  const k = Math.min(1, Math.max(0, (t - start) / SWAP_FADE));
  const e = k * k * (3 - 2 * k);
  return value + (target - value) * e;
}
