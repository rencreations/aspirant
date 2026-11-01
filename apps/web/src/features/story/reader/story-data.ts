/**
 * Reader-side view of the story index: parts, units (60 chapters and the interludes) in book
 * order, and small lookups. Pure data, safe for server and client components.
 */
import { chapters, parts, storyIndex } from "@/content/story";
import type { ChapterMeta, PartMeta } from "@/content/story-types";

export const PARTS: readonly PartMeta[] = parts;

export const TOTAL_PARAGRAPHS: number = storyIndex.stats.paragraphs;

const unitById = new Map(chapters.map((unit) => [unit.id as string, unit]));

export function getUnit(id: string): ChapterMeta | undefined {
  return unitById.get(id);
}

export function getPartMeta(n: number): PartMeta | undefined {
  return PARTS[n - 1];
}

/** "Chapter 12" or "Interlude". */
export function unitLabel(unit: ChapterMeta): string {
  return unit.number === null ? "Interlude" : `Chapter ${unit.number}`;
}

/** "12" or "IN" for the contents. */
export function unitShort(unit: ChapterMeta): string {
  return unit.number === null ? "IN" : String(unit.number).padStart(2, "0");
}
