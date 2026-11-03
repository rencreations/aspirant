"use client";

import { useEffect, type RefObject } from "react";

/**
 * Plays a muted clip only while it is on screen and the tab is shown, and pauses it otherwise
 * (so at most a screenful of clips decodes at once). A browser that refuses to play leaves the
 * poster showing.
 */
export function useAutoplay(
  ref: RefObject<HTMLVideoElement | null>,
  { threshold = 0.45, rootMargin = "0px" }: { threshold?: number; rootMargin?: string } = {},
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let visible = false;
    const update = () => {
      if (visible && document.visibilityState === "visible") void el.play().catch(() => undefined);
      else el.pause();
    };
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[entries.length - 1]?.isIntersecting ?? false;
        update();
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
      el.pause();
    };
  }, [ref, threshold, rootMargin]);
}
