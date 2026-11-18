/**
 * The preview window's state. The wall's runtime (a plain class on the canvas) opens it with a press
 * on a card, the window (a React dialog drawn by the server markup of the aspirants section) shows
 * it, and the scene reads `open` to pause the wall and hold the page. Nothing else is shared.
 */
import { create } from "zustand";

import type { Box } from "./math";

interface PreviewState {
  open: boolean;
  /** The picture shown: an index into `PREVIEW_PICTURES`. */
  index: number;
  /** Where the card it came from was on the screen when it opened (CSS px), or null. */
  from: Box | null;
  /** Which way the last step went (1 next, -1 previous, 0 none), for the slide of the picture. */
  dir: number;
  show: (index: number, from: Box | null) => void;
  step: (by: number, count: number) => void;
  close: () => void;
}

export const useHomePreview = create<PreviewState>()((set) => ({
  open: false,
  index: 0,
  from: null,
  dir: 0,
  show: (index, from) => {
    set({ open: true, index, from, dir: 0 });
  },
  step: (by, count) => {
    set((s) => ({
      index: count > 0 ? (((s.index + by) % count) + count) % count : 0,
      dir: by > 0 ? 1 : -1,
    }));
  },
  close: () => {
    set((s) => (s.open ? { open: false, dir: 0 } : s));
  },
}));

type Resolver = (id: string) => Box | null;

let resolver: Resolver | null = null;

/**
 * Where a picture's card is on the screen right now (CSS px), or null when none is drawn. The wall's
 * runtime sets it, so the window can fly back into the card it grew out of, even after the visitor
 * has stepped to another picture. Returns the way to take it out.
 */
export function setPreviewResolver(fn: Resolver | null): () => void {
  resolver = fn;
  return () => {
    if (resolver === fn) resolver = null;
  };
}

/** The card of a picture on the screen, or null. */
export function cardBoxOf(id: string): Box | null {
  return resolver ? resolver(id) : null;
}
