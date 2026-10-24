"use client";

import { useCallback, useSyncExternalStore } from "react";

import { DEFAULT_BACKGROUND, isBackgroundId, type BackgroundId } from "./backgrounds/registry";

const STORE_KEY = "aspirants:vexana:background";

/** The choice is kept in the browser, and in memory when the browser will not keep it. */
let chosen: BackgroundId | null = null;
const listeners = new Set<() => void>();

function stored(): BackgroundId | null {
  if (chosen) return chosen;
  try {
    const v = window.localStorage.getItem(STORE_KEY);
    return isBackgroundId(v) ? v : null;
  } catch {
    return null;
  }
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/**
 * The background of the hero: what the visitor chose last time, else `initial`, else the default.
 * The server and the first client render use `initial`, so nothing mismatches.
 */
export function useBackground(initial?: BackgroundId): [BackgroundId, (id: BackgroundId) => void] {
  const fallback = initial ?? DEFAULT_BACKGROUND;
  const value = useSyncExternalStore(
    subscribe,
    () => stored() ?? fallback,
    () => fallback,
  );
  const set = useCallback((id: BackgroundId) => {
    chosen = id;
    try {
      window.localStorage.setItem(STORE_KEY, id);
    } catch {
      // Kept in memory only.
    }
    for (const fn of listeners) fn();
  }, []);
  return [value, set];
}
