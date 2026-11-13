"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Every post of the Design room has its own address, `/collection/design/<slug>/`. It opens as a
 * window over the room and the address shows it, like a post that opens over a feed and has its own
 * link. The room stays mounted (it is drawn by `app/collection/design/layout.tsx`, the pages below
 * it draw nothing), so opening a window is a `pushState` and the Back button closes it. A link to a
 * post opens the same window, from a cold start.
 *
 * The search of the room (`?q=`, `?pair=`, ...) travels with the address, so the wall behind the
 * window keeps its filters and Back returns to exactly the page that was left.
 */
const BASE = "/collection/design";

/** The slug in `/collection/design/<slug>/`, or "" for the room itself. */
export function slugFromPath(pathname: string): string {
  const m = /^\/collection\/design\/([a-z0-9-]+)\/?$/u.exec(pathname);
  return m?.[1] ?? "";
}

/** The address of a post (`slug`) or of the room (no slug). `search` starts with `?` or is empty. */
export function designPath(slug: string, search = ""): string {
  return `${BASE}/${slug ? `${slug}/` : ""}${search}`;
}

/** The search of the room with the old `i` (the id of a post) taken out. */
export function withoutId(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("i");
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}

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
const DEPTH = "designDepth";

const depthOf = (): number => {
  const state = window.history.state as Record<string, unknown> | null;
  const d = state?.[DEPTH];
  return typeof d === "number" ? d : 0;
};

/** Open a post over the room: a new entry in the history, with the room's search carried along. */
export function openPost(slug: string): void {
  if (read() === slug) return;
  const state = window.history.state as Record<string, unknown> | null;
  window.history.pushState(
    { ...(state ?? {}), [DEPTH]: depthOf() + 1 },
    "",
    designPath(slug, window.location.search),
  );
  notify();
}

export interface DesignRoute {
  /** The post that is open, or "". */
  slug: string;
  /** Open a post over the room: a new entry in the history. */
  open: (slug: string) => void;
  /** Move to another post while a window is open (the arrows, the keys): the entry is replaced. */
  step: (slug: string) => void;
  /** Close the window and return to the room, at the scroll it was left at. */
  close: () => void;
  /** An old link, `?i=<id>`, becomes the address of the post. The entry is replaced. */
  forward: (slug: string) => void;
}

export function useDesignRoute(): DesignRoute {
  const slug = useSyncExternalStore(subscribe, read, () => "");

  const step = useCallback((next: string) => {
    if (read() === next) return;
    window.history.replaceState(window.history.state, "", designPath(next, window.location.search));
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
    window.history.replaceState(window.history.state, "", designPath("", window.location.search));
    notify();
  }, []);

  const forward = useCallback((next: string) => {
    window.history.replaceState(
      window.history.state,
      "",
      designPath(next, withoutId(window.location.search)),
    );
    notify();
  }, []);

  return useMemo(
    () => ({ slug, open: openPost, step, close, forward }),
    [slug, step, close, forward],
  );
}
