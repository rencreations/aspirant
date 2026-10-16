/**
 * Helpers over the story index (parts and chapter metadata, generated from `short-v2.md`).
 * The chapter text itself is fetched lazily from `public/data/story/part-XX.json`.
 */
import { storyIndex } from "./story-index.generated";
import type { ChapterMeta, PartMeta } from "./story-types";
import type { ChapterId } from "./types";

export { storyIndex };

/** The 12 parts in book order. */
export const parts: readonly PartMeta[] = storyIndex.parts;

/** All 62 units (60 chapters and 2 interludes) in book order. */
export const chapters: readonly ChapterMeta[] = storyIndex.chapters;

/** Relative path of the story index (no leading slash). Wrap it in `asset()`. */
export const STORY_INDEX_FILE = "data/story/index.json";

export function getChapterMeta(id: string): ChapterMeta | undefined {
  return chapters.find((chapter) => chapter.id === id);
}

export function getPart(number: number): PartMeta | undefined {
  return parts.find((part) => part.number === number);
}

/** The part file that holds a chapter, as a relative asset path. */
export function partFileFor(id: ChapterId): string | undefined {
  const chapter = getChapterMeta(id);
  return chapter ? getPart(chapter.part)?.file : undefined;
}

/** "Chapter 5" or "Interlude". */
export function chapterLabel(chapter: ChapterMeta): string {
  return chapter.number === null ? "Interlude" : `Chapter ${chapter.number}`;
}

/** The chapter that holds a global paragraph index (for "resume where you left off"). */
export function chapterForParagraph(index: number): ChapterMeta | undefined {
  return chapters.find(
    (chapter) =>
      index >= chapter.firstParagraphIndex &&
      index < chapter.firstParagraphIndex + chapter.paragraphCount,
  );
}
