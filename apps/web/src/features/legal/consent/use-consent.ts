import { create } from "zustand";

import { globalPrivacyControl, readSaved, saveChoice, type Choice } from "./consent";

interface ConsentState {
  /** The answer so far. Null until the visitor answers (and while the browser has not been read yet). */
  choice: Choice | null;
  /** The browser has been read. Before this the banner never shows, so a returning visitor never sees it flash. */
  ready: boolean;
  /** The banner was opened again from the menu. */
  reopened: boolean;
  /** Read the saved choice. A browser that sends Global Privacy Control counts as a refusal until the visitor says otherwise. */
  hydrate: () => void;
  answer: (choice: Choice) => void;
  /** Show the banner again, with the current answer. */
  reopen: () => void;
}

export const useConsent = create<ConsentState>((set, get) => ({
  choice: null,
  ready: false,
  reopened: false,
  hydrate: () => {
    if (get().ready) return;
    const saved = readSaved();
    set({
      ready: true,
      choice: saved?.choice ?? (globalPrivacyControl() ? "rejected" : null),
    });
  },
  answer: (choice) => {
    saveChoice(choice);
    set({ choice, reopened: false });
  },
  reopen: () => {
    set({ reopened: true });
  },
}));
