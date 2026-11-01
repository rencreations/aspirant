"use client";

/**
 * Where the reader is on the page: the chapter and paragraph under the reading line. The reading
 * engine writes it (only when a value changes) and the mini-bar and the contents sheet read it.
 */
import { create } from "zustand";

export interface ReadingPosition {
  /** Chapter id such as `c05`, or an interlude id such as `i-far-above-1`. `null` above the first one. */
  readonly chapterId: string | null;
  /** Id of the paragraph under the reading line, such as `c05-p012`. */
  readonly paragraphId: string | null;
  /** Progress through the whole story, 0 to 1. */
  readonly storyProgress: number;
  setPosition: (
    p: Partial<Pick<ReadingPosition, "chapterId" | "paragraphId" | "storyProgress">>,
  ) => void;
}

export const useReadingPosition = create<ReadingPosition>()((set) => ({
  chapterId: null,
  paragraphId: null,
  storyProgress: 0,
  setPosition: (p) => {
    set(p);
  },
}));
