/**
 * The reader's own saved state (localStorage, never throws): the place where the visitor stopped,
 * the text size and the theme. The theme is one for the whole story, light or dark, and the visitor
 * changes it in the reading settings. The chapter also goes to the site store's `lastChapter`.
 */
import { create } from "zustand";

const KEY = "aspirants:reader";

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
  loaded: false,
}));

/** The saved place counts only once the visitor has read past the very first paragraph. */
const START = "c01-p000";

export function loadReaderPrefs(): void {
  const saved = readPrefs();
  useReaderPrefs.setState({
    textScale: saved.textScale,
    theme: saved.theme,
    resume:
      saved.chapterId && saved.paragraphId && saved.paragraphId !== START
        ? { chapterId: saved.chapterId, paragraphId: saved.paragraphId }
        : null,
    loaded: true,
  });
}

export const TEXT_SCALES = [0.875, 1, 1.125, 1.25, 1.375] as const;

export interface ReaderPrefs {
  chapterId: string | null;
  paragraphId: string | null;
  textScale: number;
  theme: ReaderTheme;
}

const DEFAULTS: ReaderPrefs = {
  chapterId: null,
  paragraphId: null,
  textScale: 1,
  theme: "daybreak",
};

const ID = /^(c\d{2}|i-far-above-\d)(-p\d{3})?$/u;

function readPrefs(): ReaderPrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const data = JSON.parse(raw) as Partial<Record<keyof ReaderPrefs, unknown>>;
    const chapterId =
      typeof data.chapterId === "string" && ID.test(data.chapterId) ? data.chapterId : null;
    const paragraphId =
      typeof data.paragraphId === "string" && ID.test(data.paragraphId) ? data.paragraphId : null;
    const scale = typeof data.textScale === "number" ? data.textScale : 1;
    return {
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
    const next = { ...readPrefs(), ...patch };
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: keep going without saving */
  }
}
