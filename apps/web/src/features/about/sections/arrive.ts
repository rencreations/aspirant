"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * The reveals of the sections below the film. A part that should appear as it arrives carries
 * `data-in="false"` in the markup; this marks it `true` once, the first time it comes into view,
 * and the stylesheets do the rest with transitions of transform and opacity. The hidden states
 * are written under `:root.js` only, so a visitor without scripts sees everything.
 *
 * A part comes into view when its top edge has risen past a line near the foot of the screen.
 * `rootMargin` sets that line for the section; a part that should wait longer (a tall picture,
 * which would otherwise open while only its top edge shows) names its own with `data-in-at`, the
 * share of the screen's height that must lie under its top edge, in percent.
 *
 * The parts that are watched are plain boxes that never move themselves: what slides or scales is
 * always a child, so the observer looks at a steady target.
 */
export function useArrive<T extends HTMLElement>(
  rootMargin = "0px 0px -14% 0px",
): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = [root, ...root.querySelectorAll<HTMLElement>("[data-in]")].filter(
      (el) => el.dataset.in === "false",
    );
    if (typeof IntersectionObserver === "undefined") {
      for (const el of targets) el.dataset.in = "true";
      return;
    }
    // One observer for each line the parts wait for.
    const observers = new Map<string, IntersectionObserver>();
    const watch = (margin: string) => {
      let observer = observers.get(margin);
      if (!observer) {
        const made = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              (entry.target as HTMLElement).dataset.in = "true";
              made.unobserve(entry.target);
            }
          },
          { rootMargin: margin, threshold: 0 },
        );
        observers.set(margin, made);
        observer = made;
      }
      return observer;
    };
    for (const el of targets) {
      const at = Number.parseFloat(el.dataset.inAt ?? "");
      watch(Number.isFinite(at) ? `0px 0px -${at}% 0px` : rootMargin).observe(el);
    }
    return () => {
      for (const observer of observers.values()) observer.disconnect();
    };
  }, [rootMargin]);

  return ref;
}
