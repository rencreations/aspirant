/**
 * Helpers over the story index: the chapters (the Prologue and 87 chapters) in book order, the
 * six acts, and the neighbours of a chapter. The index is written by `scripts/story/build.py`.
 * The text of a chapter lives in its own file (`public/data/story/cNN.json`), read at build time.
 */
import raw from "../../public/data/story/index.json";

import type { ActMeta, ChapterEntry, Media, StoryChapterId, StoryIndex } from "./story-types";

export const storyIndex = raw as unknown as StoryIndex;

/** The Prologue and chapters 1 to 87 in book order. */
export const chapters: readonly ChapterEntry[] = storyIndex.chapters;

export const acts: readonly ActMeta[] = storyIndex.acts;

const byId = new Map<string, ChapterEntry>(chapters.map((c) => [c.id, c]));
const bySlug = new Map<string, ChapterEntry>(chapters.map((c) => [c.slug, c]));

export function getChapter(id: string): ChapterEntry | undefined {
  return byId.get(id);
}

export function chapterBySlug(slug: string): ChapterEntry | undefined {
  return bySlug.get(slug);
}

/** Relative path of a chapter's data file (no leading slash). Wrap it in `asset()`. */
export function chapterFile(id: StoryChapterId): string {
  return `data/story/${id}.json`;
}

export function previousChapter(id: string): ChapterEntry | undefined {
  const i = chapters.findIndex((c) => c.id === id);
  return i > 0 ? chapters[i - 1] : undefined;
}

export function nextChapter(id: string): ChapterEntry | undefined {
  const i = chapters.findIndex((c) => c.id === id);
  return i >= 0 ? chapters[i + 1] : undefined;
}

/** "Prologue" or "Chapter 12". */
export function chapterLabel(chapter: Pick<ChapterEntry, "number">): string {
  return chapter.number === 0 ? "Prologue" : `Chapter ${chapter.number}`;
}

/** "Prologue" or "Ch 12", for chips. */
export function chapterShort(chapter: Pick<ChapterEntry, "number">): string {
  return chapter.number === 0 ? "Prologue" : `Ch ${chapter.number}`;
}

export function actOf(chapter: Pick<ChapterEntry, "act">): ActMeta | undefined {
  return acts.find((a) => a.roman === chapter.act);
}

/** The chapters of one act. */
export function chaptersOfAct(act: ActMeta): readonly ChapterEntry[] {
  return chapters.filter((c) => c.number >= act.from && c.number <= act.to);
}

/** The media of an insert as a list: a panel strip carries several, the other kinds one or none. */
export function mediaList(media: Media | readonly Media[] | undefined): readonly Media[] {
  if (media === undefined) return [];
  return "kind" in media ? [media] : media;
}
