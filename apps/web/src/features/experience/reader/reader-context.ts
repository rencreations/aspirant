"use client";

import { createContext, useContext } from "react";

export interface JumpOptions {
  /** Glide there when it is close (never under reduced motion). Default false: a cut. */
  smooth?: boolean;
  /** Move keyboard focus to the target heading. Default true. */
  focus?: boolean;
}

export interface SavedPlace {
  readonly chapterId: string;
  readonly paragraphId: string | null;
}

export interface ReaderApi {
  /** Go to a Part (`part-04`), chapter (`c30`), paragraph (`c30-p012`) or any element id. */
  jumpTo: (id: string, options?: JumpOptions) => Promise<void>;
  /** Where the reader left off last time, or null. */
  resume: SavedPlace | null;
  textScale: number;
  setTextScale: (value: number) => void;
  calm: boolean;
  setCalm: (value: boolean) => void;
}

const noop = () => undefined;

export const ReaderContext = createContext<ReaderApi>({
  jumpTo: () => Promise.resolve(),
  resume: null,
  textScale: 1,
  setTextScale: noop,
  calm: false,
  setCalm: noop,
});

export function useReader(): ReaderApi {
  return useContext(ReaderContext);
}
