import type { ChapterMeta } from "@/content/story-types";

/** How many rows of the chapter list show before "Show all". */
export const COLLAPSED_ROWS = 8;

export type ChapterOrder = "first" | "latest";

/** The chapters and interludes in the order the visitor chose: book order, or the latest first. */
export function orderUnits(units: readonly ChapterMeta[], order: ChapterOrder): ChapterMeta[] {
  return order === "first" ? [...units] : [...units].reverse();
}

/** The rows that show: all of them, or only the first `limit` while the list is folded. */
export function visibleUnits(
  units: readonly ChapterMeta[],
  expanded: boolean,
  limit = COLLAPSED_ROWS,
): ChapterMeta[] {
  return expanded || units.length <= limit ? [...units] : units.slice(0, limit);
}

/** "About 4 min" of reading for a chapter of this many words (230 words a minute). */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 230));
}
