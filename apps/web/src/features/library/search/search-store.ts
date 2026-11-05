"use client";

import { create } from "zustand";

interface SearchState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** Whether the library search sheet is open. Any button or key can open it. */
export const useLibrarySearch = create<SearchState>((set) => ({
  open: false,
  setOpen: (open) => {
    set({ open });
  },
}));
