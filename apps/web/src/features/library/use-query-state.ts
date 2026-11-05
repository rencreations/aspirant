"use client";

import { useCallback, useSyncExternalStore } from "react";

function readParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

/** Every mounted hook is told when any of them changes the address. */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("popstate", onChange);
  };
}

/**
 * One value kept in the address (`?who=layla`), so a view can be shared and the back button
 * keeps working. It is `initial` on the server and on the first render, then it follows the
 * address (also when another part of the page changes it). Setting an empty value removes the
 * parameter.
 */
export function useQueryState(key: string, initial = ""): [string, (next: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readParam(key) ?? initial,
    () => initial,
  );

  const set = useCallback(
    (next: string) => {
      const url = new URL(window.location.href);
      if (next && next !== initial) url.searchParams.set(key, next);
      else url.searchParams.delete(key);
      window.history.replaceState(window.history.state, "", url);
      listeners.forEach((notify) => {
        notify();
      });
    },
    [key, initial],
  );

  return [value, set];
}
