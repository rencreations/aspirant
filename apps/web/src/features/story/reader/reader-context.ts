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
  /** The Part this page holds (1 to 12). */
  part: number;
  /** Go to a chapter (`c30`), paragraph (`c30-p012`) or any element id on this page. */
  jumpTo: (id: string, options?: JumpOptions) => Promise<void>;
  textScale: number;
  setTextScale: (value: number) => void;
  theme: ReaderTheme;
  setTheme: (value: ReaderTheme) => void;
}

const noop = () => undefined;

export const ReaderContext = createContext<ReaderApi>({
  part: 1,
  jumpTo: () => Promise.resolve(),
  textScale: 1,
  setTextScale: noop,
  theme: "daybreak",
  setTheme: noop,
});

export function useReader(): ReaderApi {
  return useContext(ReaderContext);
}
