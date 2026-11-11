"use client";

import { useCallback, useSyncExternalStore } from "react";

import { lorePath, slugFromPath } from "./model";

/**
 * The address of the codex is `/collection/lore/<slug>/`: an entry opens as a window over the room
 * and the address shows it, like a post that opens over a feed and has its own link. The room
 * stays mounted (the pages are `app/collection/lore/`, one layout, nothing to swap), so opening a
 * window is a `pushState` and the Back button closes it.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("popstate", onChange);
  };
}

const read = (): string => slugFromPath(window.location.pathname);

function notify(): void {
  listeners.forEach((fn) => {
    fn();
  });
}

/** The number of windows this room has stacked in the history since it was on its own address. */
const DEPTH = "loreDepth";

const depthOf = (): number => {
  const state = window.history.state as Record<string, unknown> | null;
  const d = state?.[DEPTH];
  return typeof d === "number" ? d : 0;
};

export function useLoreSlug(initial = ""): string {
  return useSyncExternalStore(subscribe, read, () => initial);
}

export function useOpenLore(): { open: (slug: string) => void; close: () => void } {
  const open = useCallback((slug: string) => {
    if (read() === slug) return;
    const state = window.history.state as Record<string, unknown> | null;
    window.history.pushState({ ...(state ?? {}), [DEPTH]: depthOf() + 1 }, "", lorePath(slug));
    notify();
  }, []);
  const close = useCallback(() => {
    const depth = depthOf();
    if (depth > 0) {
      // Every window the room opened is taken back in one go, to the room's own address and scroll.
      window.history.go(-depth);
      return;
    }
    // A window the visitor arrived on (a shared link): the room replaces it.
    const state = window.history.state as Record<string, unknown> | null;
    window.history.replaceState(state, "", lorePath(""));
    notify();
  }, []);
  return { open, close };
}
