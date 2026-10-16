import { z } from "zod";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

/** @public */
export type MotionPreference = "auto" | "reduced";
export type ThemeName = "storm" | "daybreak";

/** sessionStorage key: set once the visitor has passed the loader in this tab. */
export const ENTERED_KEY = "aspirants:entered";
/** localStorage key for persisted preferences. */
export const PREFS_KEY = "aspirants:prefs";

export interface SiteState {
  /** The visitor passed the loader (this session). */
  entered: boolean;
  setEntered: (value: boolean) => void;
  /** Sound is off. Persisted. */
  muted: boolean;
  setMuted: (value: boolean) => void;
  toggleMute: () => void;
  /** "auto" follows the OS setting; "reduced" forces reduced motion. Persisted. */
  motion: MotionPreference;
  setMotion: (value: MotionPreference) => void;
  /** Theme of the page root (html[data-theme]). Pages set it; not persisted. */
  theme: ThemeName;
  setTheme: (value: ThemeName) => void;
  /** Last chapter id read in /experience, for "resume where you left off". Persisted. */
  lastChapter: string | null;
  setLastChapter: (value: string | null) => void;
}

/** Storage that never throws (private mode, blocked cookies, quota). */
function safeStorage(kind: "localStorage" | "sessionStorage"): StateStorage {
  const get = (): Storage | null => {
    try {
      return typeof window === "undefined" ? null : window[kind];
    } catch {
      return null;
    }
  };
  return {
    getItem: (name) => {
      try {
        return get()?.getItem(name) ?? null;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        get()?.setItem(name, value);
      } catch {
        /* storage unavailable: keep the value in memory only */
      }
    },
    removeItem: (name) => {
      try {
        get()?.removeItem(name);
      } catch {
        /* ignore */
      }
    },
  };
}

const session = safeStorage("sessionStorage");

/** Read the session "entered" flag without throwing. */
export function readEntered(): boolean {
  return session.getItem(ENTERED_KEY) === "1";
}

const PrefsSchema = z
  .object({
    muted: z.boolean(),
    motion: z.enum(["auto", "reduced"]),
    lastChapter: z.string().max(64).nullable(),
  })
  .partial();

/**
 * Global site state. Persisted keys (muted, motion, lastChapter) live in localStorage under
 * "aspirants:prefs" and are validated on load. Rehydration is manual (see <SiteProviders>),
 * so server and first client render match.
 */
export const useSiteStore = create<SiteState>()(
  persist(
    (set) => ({
      entered: false,
      setEntered: (value) => {
        if (value) session.setItem(ENTERED_KEY, "1");
        else session.removeItem(ENTERED_KEY);
        set({ entered: value });
      },
      muted: false,
      setMuted: (value) => set({ muted: value }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
      motion: "auto",
      setMotion: (value) => set({ motion: value }),
      theme: "storm",
      setTheme: (value) => set({ theme: value }),
      lastChapter: null,
      setLastChapter: (value) => set({ lastChapter: value }),
    }),
    {
      name: PREFS_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage("localStorage")),
      skipHydration: true,
      partialize: (s) => ({ muted: s.muted, motion: s.motion, lastChapter: s.lastChapter }),
      merge: (persisted, current) => {
        const parsed = PrefsSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

/** Load persisted preferences and the session flag. Call once on the client. */
export async function hydrateSiteStore(): Promise<void> {
  try {
    await useSiteStore.persist.rehydrate();
  } catch {
    /* corrupt storage: keep defaults */
  }
  if (readEntered()) useSiteStore.setState({ entered: true });
}
