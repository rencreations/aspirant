"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Two attributes on one element, written without a render:
 *
 *  - `data-in="true"` once it has been on screen (the CSS of `[data-armed]` children fades them in);
 *  - `data-live="true|false"` while it is near the screen, so a loop inside it can pause when it
 *    is far away (`animation-play-state`).
 *
 * `data-armed` is set when the hook starts, so a page without script (or an observer that never
 * fires) shows everything.
 */
export function useReveal<T extends HTMLElement>(margin = "160px"): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.dataset.in = "true";
      el.dataset.live = "true";
      return;
    }
    el.dataset.armed = "true";
    el.dataset.live = "false";
    const observer = new IntersectionObserver(
      (entries) => {
        // The last entry is how it is now (several queue up when the page is busy).
        const entry = entries[entries.length - 1];
        if (!entry) return;
        el.dataset.live = entry.isIntersecting ? "true" : "false";
        if (entry.isIntersecting) el.dataset.in = "true";
      },
      { rootMargin: `${margin} 0px ${margin} 0px`, threshold: 0.12 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [margin]);
  return ref;
}
