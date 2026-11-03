import type { Route } from "next";

import { actOf, chapters, getChapter } from "@/content/story";
import { routes } from "@/lib/site";

import legacy from "./legacy-map.json";

/** Where a chapter of the book lives: `/story/prologue/` or `/story/chapter-07/`. */
export function chapterHref(id: string, paragraph?: string): Route {
  const slug = getChapter(id)?.slug ?? chapters[0]?.slug ?? "prologue";
  const hash = paragraph ? `#${paragraph}` : "";
  return `${routes.story}/${slug}${hash}` as Route;
}

/** The end page, after the last chapter. */
export const END_HREF = `${routes.story}/the-end` as Route;

interface LegacyMap {
  readonly chapters: Readonly<Record<string, string>>;
  readonly parts: Readonly<Record<string, string>>;
}

const LEGACY = legacy as unknown as LegacyMap;

/** Every chapter id of the old story (`c01` to `c60`, `i-far-above-1`, `i-far-above-2`). */
export const LEGACY_CHAPTER_IDS: readonly string[] = Object.keys(LEGACY.chapters);

/** The new chapter that an old story chapter maps to, or the first chapter. */
function mapped(oldId: string): string {
  const unit = /^(c\d{2}|i-far-above-\d)/u.exec(oldId)?.[1] ?? oldId;
  return LEGACY.chapters[unit] ?? "c00";
}

/**
 * The page for a chapter id as the other pages of the site still know it. They were written for
 * an older story (60 chapters and two interludes), so an old id is mapped to the nearest chapter
 * of the book (`legacy-map.json`). Paragraph ids of the old story mean nothing here and are
 * dropped. Use `chapterHref` for an id of the new book.
 */
export function storyChapterHref(oldId: string): Route {
  return chapterHref(mapped(oldId));
}

/** "Chapter 12" or "Prologue", for the chapter an old id maps to. */
export function chapterName(oldId: string): string {
  const entry = getChapter(mapped(oldId));
  if (!entry) return oldId;
  return entry.number === 0 ? "Prologue" : `Chapter ${entry.number}`;
}

/** The short form for a chip: "Ch 12" or "Prologue". */
export function chapterShort(oldId: string): string {
  const entry = getChapter(mapped(oldId));
  if (!entry) return oldId;
  return entry.number === 0 ? "Prologue" : `Ch ${entry.number}`;
}

/** The chapter an old `/story/part-NN` page opens now. */
export function legacyPartHref(part: number): Route {
  return chapterHref(LEGACY.parts[String(part)] ?? "c00");
}

/** The slugs of the old Part pages (`part-01` to `part-12`), kept as redirects. */
export const LEGACY_PART_SLUGS: readonly string[] = Array.from(
  { length: 12 },
  (_, i) => `part-${String(i + 1).padStart(2, "0")}`,
);

/** Label, number, title and act of the chapter an old id maps to, for cards on other pages. */
export function legacyChapterInfo(oldId: string): {
  label: string;
  number: string;
  title: string;
  part: string;
} {
  const entry = getChapter(mapped(oldId));
  if (!entry) return { label: "Chapter", number: "", title: oldId, part: "" };
  const act = actOf(entry);
  return {
    label: entry.number === 0 ? "Prologue" : `Chapter ${entry.number}`,
    number: entry.number === 0 ? "PR" : String(entry.number).padStart(2, "0"),
    title: entry.number === 0 ? "Prologue" : entry.title,
    part: act ? `Act ${act.roman}` : "",
  };
}
