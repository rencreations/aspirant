"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Which video is open in the viewer, kept in the address: `?i=<id>` and `&t=<seconds>`. Other rooms
 * and the library search link to a video this way (`videoHref`).
 *
 * Opening from the wall adds a history entry, so the Back button closes the viewer. Going to the
 * next or the previous video replaces the entry, so Back never walks through them one by one. The
 * library search changes the address by itself and fires `popstate`: this hook follows it too.
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

function notify(): void {
  listeners.forEach((l) => {
    l();
  });
}

const snapshot = () => window.location.search;
const serverSnapshot = () => "";

/** The flag that marks a history entry made by opening the viewer (so closing can go back one). */
const PUSHED = "othersViewer";

export interface OpenVideo {
  /** The id in the address, or an empty string. */
  id: string;
  /** The start time in the address (`t`), as written, or an empty string. */
  t: string;
  /** Open a video from the wall (adds a history entry). */
  open: (id: string) => void;
  /** Show another video in the open viewer (replaces the entry). `t` is dropped. */
  show: (id: string) => void;
  /** Write the start time (replaces the entry). An empty value removes it. */
  setT: (t: string) => void;
  /** Close the viewer. */
  close: () => void;
}

function write(mutate: (url: URL) => void, push: boolean): void {
  const url = new URL(window.location.href);
  mutate(url);
  const state: unknown = window.history.state;
  if (push) {
    window.history.pushState({ ...(state as object | null), [PUSHED]: true }, "", url);
  } else {
    window.history.replaceState(state, "", url);
  }
  notify();
}

export function useOpenVideo(): OpenVideo {
  const search = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const { id, t } = useMemo(() => {
    const params = new URLSearchParams(search);
    return { id: params.get("i") ?? "", t: params.get("t") ?? "" };
  }, [search]);

  const open = useCallback((next: string) => {
    write((url) => {
      url.searchParams.set("i", next);
      url.searchParams.delete("t");
    }, true);
  }, []);

  const show = useCallback((next: string) => {
    write((url) => {
      url.searchParams.set("i", next);
      url.searchParams.delete("t");
    }, false);
  }, []);

  const setT = useCallback((next: string) => {
    write((url) => {
      if (next) url.searchParams.set("t", next);
      else url.searchParams.delete("t");
    }, false);
  }, []);

  const close = useCallback(() => {
    const state = window.history.state as Record<string, unknown> | null;
    if (state?.[PUSHED]) {
      // The entry that opened the viewer: going back removes it, and the page keeps its place.
      window.history.back();
      return;
    }
    write((url) => {
      url.searchParams.delete("i");
      url.searchParams.delete("t");
    }, false);
  }, []);

  return useMemo(() => ({ id, t, open, show, setT, close }), [id, t, open, show, setT, close]);
}
