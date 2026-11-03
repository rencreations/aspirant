/**
 * The reader's own saved state (localStorage, never throws): the place where the visitor stopped,
 * the text size and the theme. The theme is one for the whole story, light or dark, and the visitor
 * changes it in the reading settings. The chapter also goes to the site store's `lastChapter`.
 * The saved place carries a version: a place saved in the old story (another book) is ignored.
 */
import { create } from "zustand";

import { getChapter } from "@/content/story";

const KEY = "aspirants:reader";
/** Bumped when the book changes, so an old saved place never points into the wrong story. */
const BOOK_VERSION = 2;

/** Light is "daybreak", dark is "storm" (the two worlds of the site's tokens). */
export type ReaderTheme = "daybreak" | "storm";

interface SavedPlace {
  readonly chapterId: string;
  readonly paragraphId: string | null;
}

interface LivePrefs {
  readonly textScale: number;
  readonly theme: ReaderTheme;
  /** Where the visitor stopped on a previous visit (read once on load). */
  readonly resume: SavedPlace | null;
  /** The highest chapter number the visitor has reached, or -1. Sealed pictures open up to it. */
  readonly furthest: number;
  /** True once the saved values have been read (the server and the first client render use defaults). */
  readonly loaded: boolean;
}

/**
 * Live reader preferences. Starts at the defaults on the server and the first client render,
 * then `loadReaderPrefs()` fills it from storage after hydration.
 */
export const useReaderPrefs = create<LivePrefs>()(() => ({
  textScale: 1,
  theme: "daybreak",
  resume: null,
  furthest: -1,
  loaded: false,
}));

/** The saved place counts only once the visitor has read past the very first paragraph. */
const START = "c00-p000";

export function loadReaderPrefs(): void {
  const saved = readPrefs();
  useReaderPrefs.setState({
    textScale: saved.textScale,
    theme: saved.theme,
    resume:
      saved.chapterId && saved.paragraphId && saved.paragraphId !== START
        ? { chapterId: saved.chapterId, paragraphId: saved.paragraphId }
        : null,
    furthest: saved.furthest ?? -1,
    loaded: true,
  });
}

export const TEXT_SCALES = [0.875, 1, 1.125, 1.25, 1.375] as const;

export interface ReaderPrefs {
  chapterId: string | null;
  paragraphId: string | null;
  textScale: number;
  theme: ReaderTheme;
  furthest: number | null;
}

const DEFAULTS: ReaderPrefs = {
  chapterId: null,
  paragraphId: null,
  textScale: 1,
  theme: "daybreak",
  furthest: null,
};

/** `c05` or `c05-p012`. */
const PLACE_ID = /^(c\d{2})(-p\d{3})?$/u;

function readPrefs(): ReaderPrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const data = JSON.parse(raw) as Partial<Record<keyof ReaderPrefs | "v", unknown>>;
    const sameBook = data.v === BOOK_VERSION;
    const known = (id: unknown): id is string => {
      if (typeof id !== "string") return false;
      const m = PLACE_ID.exec(id);
      return m !== null && getChapter(m[1] ?? "") !== undefined;
    };
    const chapterId = sameBook && known(data.chapterId) ? data.chapterId : null;
    const paragraphId =
      chapterId && known(data.paragraphId) && data.paragraphId.startsWith(`${chapterId}-`)
        ? data.paragraphId
        : null;
    const scale = typeof data.textScale === "number" ? data.textScale : 1;
    const furthest =
      sameBook && typeof data.furthest === "number" && Number.isInteger(data.furthest)
        ? data.furthest
        : null;
    return {
      furthest,
      chapterId,
      paragraphId,
      textScale: (TEXT_SCALES as readonly number[]).includes(scale) ? scale : 1,
      theme: data.theme === "storm" ? "storm" : "daybreak",
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writePrefs(patch: Partial<ReaderPrefs>): void {
  try {
    const current = readPrefs();
    const next = { ...current, ...patch, v: BOOK_VERSION };
    if (patch.chapterId) {
      const n = getChapter(patch.chapterId)?.number ?? -1;
      next.furthest = Math.max(current.furthest ?? -1, n);
    }
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: keep going without saving */
  }
}

/**
 * Should a chapter's picture show for this visitor, or its sealed twin? A chapter opens once
 * the visitor has reached it (or any later one). `furthest` is -1 for a fresh visitor.
 */
export function isRevealed(chapterNumber: number, furthest: number): boolean {
  return chapterNumber <= furthest;
}
