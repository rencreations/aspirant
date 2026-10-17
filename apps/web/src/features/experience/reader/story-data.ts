/**
 * Reader-side view of the story index: parts, units (60 chapters and the interludes) in book
 * order, and small lookups. Pure data, safe for server and client components.
 */
import { chapters, parts, storyIndex } from "@/content/story";
import type { ChapterMeta, PartMeta } from "@/content/story-types";

import type { PartNumber } from "../contract";

export const PARTS: readonly PartMeta[] = parts;

/** Every chapter and interlude, in book order. */
export const UNITS: readonly ChapterMeta[] = chapters;

export const TOTAL_PARAGRAPHS: number = storyIndex.stats.paragraphs;

const unitById = new Map(UNITS.map((unit) => [unit.id as string, unit]));
const unitOrder = new Map(UNITS.map((unit, i) => [unit.id as string, i]));

export function getUnit(id: string): ChapterMeta | undefined {
  return unitById.get(id);
}

/** Position of a unit in book order (0 based), or -1. */
export function unitIndex(id: string): number {
  return unitOrder.get(id) ?? -1;
}

export function toPartNumber(n: number): PartNumber {
  return Math.min(12, Math.max(1, Math.round(n))) as PartNumber;
}

export function getPartMeta(n: number): PartMeta | undefined {
  return PARTS[n - 1];
}

/** "Chapter 12" or "Interlude". */
export function unitLabel(unit: ChapterMeta): string {
  return unit.number === null ? "Interlude" : `Chapter ${unit.number}`;
}

/** "12" or "IN" for the rail and the mini-bar. */
export function unitShort(unit: ChapterMeta): string {
  return unit.number === null ? "IN" : String(unit.number).padStart(2, "0");
}

/** "One" from "Part One". */
export function partWord(part: PartMeta): string {
  return part.label.replace(/^Part\s+/u, "");
}

export function partAnchor(n: number): string {
  return `part-${String(n).padStart(2, "0")}`;
}

/** Index of a unit inside its part (0 based). */
export function indexInPart(unit: ChapterMeta): number {
  return getPartMeta(unit.part)?.chapterIds.indexOf(unit.id) ?? -1;
}
