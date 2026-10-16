import type { Mood, PartNumber } from "../contract";

/**
 * Stub, owned by the scene engineer. The reader only needs `partMood` and `chapterMood`.
 * Replace the table with the real per-part and per-chapter moods.
 */
const PART_MOODS: Readonly<Record<PartNumber, Mood>> = {
  1: "daybreak",
  2: "daybreak",
  3: "storm",
  4: "storm",
  5: "storm",
  6: "daybreak",
  7: "storm",
  8: "daybreak",
  9: "daybreak",
  10: "storm",
  11: "storm",
  12: "daybreak",
};

export function partMood(part: PartNumber): Mood {
  return PART_MOODS[part];
}

/** A chapter may override its part's mood (for example a flashback inside a dark part). */
export function chapterMood(_chapterId: string, part: PartNumber): Mood {
  return partMood(part);
}
