"use client";

import { useIsoLayoutEffect } from "@/lib/hooks";

import { chapterHref } from "../chapter-href";
import { loadReaderPrefs, useReaderPrefs, type ReaderTheme } from "../reader/prefs";

export interface StoryProgress {
  /** The saved place has been read (the server and the first client render know nothing of it). */
  loaded: boolean;
  /** Where the visitor stopped, or `null` for a fresh visitor. */
  resume: { chapterId: string; href: ReturnType<typeof chapterHref> } | null;
  /** The highest chapter number the visitor has reached (-1 for a fresh visitor). */
  furthest: number;
  /** The theme the visitor picked in the reading settings. */
  theme: ReaderTheme;
}

/**
 * The visitor's place in the story and their theme, from the reader's own saved state
 * (`reader/prefs.ts`). It is read before the first paint after hydration.
 */
export function useStoryProgress(): StoryProgress {
  const loaded = useReaderPrefs((st) => st.loaded);
  const saved = useReaderPrefs((st) => st.resume);
  const theme = useReaderPrefs((st) => st.theme);
  const furthest = useReaderPrefs((st) => st.furthest);
  useIsoLayoutEffect(() => {
    loadReaderPrefs();
  }, []);
  return {
    loaded,
    theme,
    furthest,
    resume: saved
      ? {
          chapterId: saved.chapterId,
          href: chapterHref(saved.chapterId, saved.paragraphId ?? undefined),
        }
      : null,
  };
}
