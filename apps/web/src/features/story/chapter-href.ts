import type { Route } from "next";

import { getChapterMeta } from "@/content/story";
import { routes } from "@/lib/site";

/** The slug of a reading page: `part-01` to `part-12`. */
export function partSlug(part: number): string {
  return `part-${String(part).padStart(2, "0")}`;
}

/** The page that holds one Part of the story, for example `/story/part-03`. */
export function partHref(part: number): Route {
  return `${routes.story}/${partSlug(part)}` as Route;
}

/**
 * The one place that decides where a chapter link points. The story is read one Part per page
 * (`/story/part-03/`), and every chapter and interlude is an element on its Part's page with the
 * id `c01` to `c60` (`i-far-above-1` and `i-far-above-2` for the interludes), so a chapter is the
 * hash on its Part. A paragraph (`c12-p034`) works the same way. Unknown ids go to the first Part.
 */
export function storyChapterHref(id: string): Route {
  const unit = /^(c\d{2}|i-far-above-\d)/u.exec(id)?.[1] ?? id;
  const part = getChapterMeta(unit)?.part ?? 1;
  return `${partHref(part)}/#${id}` as Route;
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
