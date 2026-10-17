/**
 * The reader's own saved state (localStorage, never throws): last position, text size and
 * Calm reading. The chapter also goes to the site store's `lastChapter`.
 */
import { create } from "zustand";

const KEY = "aspirants:reader";

interface LivePrefs {
  readonly textScale: number;
  readonly calm: boolean;
  /** Where the reader left off on a previous visit (read once on load). */
  readonly resume: { readonly chapterId: string; readonly paragraphId: string | null } | null;
}

/**
 * Live reader preferences. Starts at the defaults on the server and the first client render,
 * then `loadReaderPrefs()` fills it from storage after hydration.
 */
export const useReaderPrefs = create<LivePrefs>()(() => ({
  textScale: 1,
  calm: false,
  resume: null,
}));

export function loadReaderPrefs(): void {
  const saved = readPrefs();
  useReaderPrefs.setState({
    textScale: saved.textScale,
    calm: saved.calm,
    resume:
      saved.chapterId && saved.paragraphId && saved.paragraphId !== "c01-p000"
        ? { chapterId: saved.chapterId, paragraphId: saved.paragraphId }
        : null,
  });
}

export const TEXT_SCALES = [0.875, 1, 1.125, 1.25, 1.375] as const;

export interface ReaderPrefs {
  chapterId: string | null;
  paragraphId: string | null;
  textScale: number;
  calm: boolean;
}

const DEFAULTS: ReaderPrefs = { chapterId: null, paragraphId: null, textScale: 1, calm: false };

const ID = /^(c\d{2}|i-far-above-\d)(-p\d{3})?$/u;

export function readPrefs(): ReaderPrefs {
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
      calm: data.calm === true,
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
