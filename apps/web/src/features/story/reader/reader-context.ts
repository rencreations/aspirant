"use client";

import { createContext, useContext } from "react";

import type { ReaderTheme } from "./prefs";

export interface JumpOptions {
  /** Glide there when it is close. Default false: a cut. */
  smooth?: boolean;
  /** Move keyboard focus to the target heading. Default true. */
  focus?: boolean;
}

export interface ReaderApi {
  /** The chapter this page holds (`c05`). */
  chapterId: string;
  /** Go to a paragraph (`c05-p012`) or any element id on this page. */
  jumpTo: (id: string, options?: JumpOptions) => Promise<void>;
  textScale: number;
  setTextScale: (value: number) => void;
  theme: ReaderTheme;
  setTheme: (value: ReaderTheme) => void;
}

const noop = () => undefined;

export const ReaderContext = createContext<ReaderApi>({
  chapterId: "c00",
  jumpTo: () => Promise.resolve(),
  textScale: 1,
  setTextScale: noop,
  theme: "daybreak",
  setTheme: noop,
});

export function useReader(): ReaderApi {
  return useContext(ReaderContext);
}
