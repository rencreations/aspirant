/**
 * The trailer window's state. The strip's runtime (a plain class on the canvas) opens it with a press
 * on the grown film or on the play button, the window itself (the site's player, drawn by the server
 * markup of the strip) shows it, and the scene reads `open` to hold the page and rest the film.
 */
import { create } from "zustand";

import type { Box } from "../../fx/video-plane";

interface StripPlayerState {
  open: boolean;
  /** Where the frame was on the screen when it opened (CSS px): the player grows out of it. */
  from: Box | null;
  show: (from: Box | null) => void;
  close: () => void;
}

export const useStripPlayer = create<StripPlayerState>()((set) => ({
  open: false,
  from: null,
  show: (from) => {
    set({ open: true, from });
  },
  close: () => {
    set((s) => (s.open ? { open: false } : s));
  },
}));
