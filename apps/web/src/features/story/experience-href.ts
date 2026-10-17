import type { Route } from "next";

import { getChapterMeta } from "@/content/story";
import { routes } from "@/lib/site";

/**
 * The one place that decides where a chapter link points. The reader in `/experience` gives
 * every chapter an id of `c01` to `c60` (and `i-far-above-1`, `i-far-above-2` for the
 * interludes), so a chapter is the hash on the route. Change this function if that moves.
 */
export function experienceHref(chapterId: string): Route {
  return `${routes.experience}/#${chapterId}` as Route;
}

/** "Chapter 12" for a chapter, "Far Above" for an interlude. */
export function chapterName(chapterId: string): string {
  const meta = getChapterMeta(chapterId);
  if (!meta) return chapterId;
  return meta.number === null ? "Far Above" : `Chapter ${meta.number}`;
}

/** The short form for a chip: "Ch 12" or "Far Above". */
export function chapterShort(chapterId: string): string {
  const meta = getChapterMeta(chapterId);
  if (!meta) return chapterId;
  return meta.number === null ? "Far Above" : `Ch ${meta.number}`;
}
