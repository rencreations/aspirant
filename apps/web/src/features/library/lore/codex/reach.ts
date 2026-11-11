"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import { loadReaderPrefs, useReaderPrefs } from "@/features/story/reader/prefs";

const KEY = "aspirants:lore:spoilers";

type Pref = "hide" | "show" | null;

const listeners = new Set<() => void>();

function readPref(): Pref {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "hide" || v === "show" ? v : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export interface Reach {
  /** The highest chapter the visitor has reached (-1 when they have not started the story). */
  furthest: number;
  /** Facts of later chapters are hidden. */
  shield: boolean;
  /** What entries and facts are shown up to: `furthest` with the shield, else everything. */
  reach: number;
  setShield: (on: boolean) => void;
}

/**
 * How much of the story the codex may show. A visitor who has read on has the spoiler shield on by
 * default (the entries and facts of chapters they have not reached stay shut); one who has not
 * started sees everything, and is told so. Either can switch it.
 */
export function useReach(): Reach {
  const furthest = useReaderPrefs((s) => s.furthest);
  const loaded = useReaderPrefs((s) => s.loaded);
  useEffect(() => {
    loadReaderPrefs();
  }, []);
  const pref = useSyncExternalStore(subscribe, readPref, () => null);
  const shield = pref ? pref === "hide" : furthest >= 0;
  const setShield = useCallback((on: boolean) => {
    try {
      window.localStorage.setItem(KEY, on ? "hide" : "show");
    } catch {
      /* the choice is kept for this visit only */
    }
    listeners.forEach((notify) => {
      notify();
    });
  }, []);
  // Until the saved place is read the codex shows nothing it would have to take back.
  const reach = !loaded ? -1 : shield ? furthest : Number.POSITIVE_INFINITY;
  return { furthest, shield, reach, setShield };
}
