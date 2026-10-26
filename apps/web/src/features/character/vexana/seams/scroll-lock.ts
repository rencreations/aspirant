"use client";

import { useCallback, useEffect, useRef } from "react";

import { useLenis } from "@/components/smooth-scroll";

/** The keys that scroll a page. */
const SCROLL_KEYS = new Set([
  " ",
  "Spacebar",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  "ArrowUp",
  "ArrowDown",
]);

/** A scroll key pressed outside a field (typing in a field is left alone). */
export function isScrollKey(e: { key: string; target?: EventTarget | null }): boolean {
  if (!SCROLL_KEYS.has(e.key)) return false;
  const t = e.target;
  if (t && typeof (t as HTMLElement).tagName === "string") {
    const el = t as HTMLElement;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) {
      return false;
    }
  }
  return true;
}

/** The longest a lock is ever held: a safety net against a lock nobody released, never a timer to wait for. */
export const LOCK_LIMIT_MS = 3000;

/**
 * A lock on the page's scrolling, for the moment a transition has covered the screen and the next
 * section is arriving by itself. It stops the smooth scroller (which also clips the page's overflow),
 * and swallows the wheel, a touch drag and the scroll keys, so a visitor who keeps scrolling cannot
 * carry the page past the heading of the section that is arriving. `lock()` returns the way back:
 * calling it gives the scroll back, once, with whatever the visitor did meanwhile forgotten (the
 * smooth scroller's target is set to where the page is, so nothing is left to jump to).
 * It is always given back after `LOCK_LIMIT_MS` (or the `limitMs` a longer arrival asks for) and when
 * the component goes.
 */
export function useScrollLock() {
  const lenis = useLenis();
  const api = useRef(lenis);
  const release = useRef<(() => void) | null>(null);
  useEffect(() => {
    api.current = lenis;
  });

  const unlock = useCallback(() => {
    const r = release.current;
    release.current = null;
    r?.();
  }, []);

  const lock = useCallback(
    (limitMs: number = LOCK_LIMIT_MS): (() => void) => {
      if (release.current) return unlock;
      const l = api.current;
      l.pause();
      const stop = (e: Event) => {
        if (e.cancelable) e.preventDefault();
      };
      const onKey = (e: KeyboardEvent) => {
        if (isScrollKey(e) && e.cancelable) e.preventDefault();
      };
      const opts = { passive: false, capture: true } as const;
      window.addEventListener("wheel", stop, opts);
      window.addEventListener("touchmove", stop, opts);
      window.addEventListener("keydown", onKey, true);
      const safety = window.setTimeout(unlock, limitMs);
      release.current = () => {
        window.clearTimeout(safety);
        window.removeEventListener("wheel", stop, opts);
        window.removeEventListener("touchmove", stop, opts);
        window.removeEventListener("keydown", onKey, true);
        const lenisNow = api.current.getLenis();
        // Whatever was scrolled while the page was locked is forgotten: the smooth scroller starts
        // again from where the page is.
        if (lenisNow) lenisNow.scrollTo(window.scrollY, { immediate: true, force: true });
        api.current.resume();
      };
      return unlock;
    },
    [unlock],
  );

  // Given back when the section goes (a route change, the page closing).
  useEffect(() => unlock, [unlock]);

  return { lock, unlock };
}
