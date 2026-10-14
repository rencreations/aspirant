import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  /** Disable heavy WebGL/animation effects (also respected automatically via prefers-reduced-motion). */
  reducedEffects: boolean;
  toggleReducedEffects: () => void;
  setReducedEffects: (value: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      reducedEffects: false,
      toggleReducedEffects: () => set((s) => ({ reducedEffects: !s.reducedEffects })),
      setReducedEffects: (value) => set({ reducedEffects: value }),
    }),
    { name: "aspirant-ui" },
  ),
);
