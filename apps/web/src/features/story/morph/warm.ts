/**
 * Warming the chapter a morph leads to: its loading list (the title card's picture, or the loop
 * held whole in memory) and its page code. Shared by the card, the Before link and the pulls, so a
 * chapter is asked for once. The progress is real: it comes from the loading list.
 */
import type { Route } from "next";

import { runPreload } from "@/lib/preload";
import { routeItems } from "@/lib/route-preloads";

export interface Warm {
  /** Every file the page needs on first paint has arrived. */
  readonly done: boolean;
  /** 0 to 1. */
  readonly progress: number;
  readonly ready: Promise<void>;
  /** Called with the progress while it loads. Returns the unsubscribe. */
  readonly listen: (fn: (progress: number) => void) => () => void;
}

const warmed = new Map<string, Warm>();

function pathOf(href: string): string {
  return (href.split(/[?#]/u)[0] ?? "/").replace(/\/+$/u, "") || "/";
}

export function warmRoute(href: Route, prefetch: (href: Route) => void): Warm {
  const path = pathOf(href);
  const known = warmed.get(path);
  if (known) return known;
  prefetch(href);
  const listeners = new Set<(progress: number) => void>();
  const state = {
    done: false,
    progress: 0,
    ready: Promise.resolve(),
    listen: (fn: (progress: number) => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
  state.ready = runPreload(routeItems(path), (p) => {
    state.progress = p.progress;
    for (const fn of listeners) fn(p.progress);
  })
    // A list never fails (a file is tried again until it comes, or skipped when it is gone), but
    // a morph must never wait on a promise that cannot end.
    .catch(() => undefined)
    .then(() => {
      state.done = true;
      state.progress = 1;
      for (const fn of listeners) fn(1);
    });
  warmed.set(path, state);
  return state;
}
