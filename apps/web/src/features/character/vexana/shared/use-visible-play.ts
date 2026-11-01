"use client";

import { useEffect, type RefObject } from "react";

import { giveSource } from "./autoplay";

/**
 * Plays a muted looping video only while its frame is on screen. It gets its source when the
 * frame is first close to the screen (the preloaded copy if there is one), and it pauses when the
 * frame leaves, the tab is hidden.
 */
export function useVisiblePlay(
  video: RefObject<HTMLVideoElement | null>,
  frame: RefObject<HTMLElement | null>,
  file: string,
) {
  useEffect(() => {
    const v = video.current;
    const f = frame.current;
    if (!v || !f) return;
    let near = false;
    let seen = false;
    const apply = () => {
      if (near && seen) {
        if (v.paused) void v.play().catch(() => undefined);
      } else if (!v.paused) {
        v.pause();
      }
    };
    const warm = new IntersectionObserver(
      (entries) => {
        // The last entry is how it is now (several queue up when the page is busy).
        const e = entries[entries.length - 1];
        near = e?.isIntersecting ?? false;
        if (near && !v.getAttribute("src")) {
          giveSource(v, file);
          v.load();
        }
        apply();
      },
      { rootMargin: "60% 0px 60% 0px" },
    );
    const view = new IntersectionObserver(
      (entries) => {
        // The last entry is how it is now (several queue up when the page is busy).
        const e = entries[entries.length - 1];
        seen = e?.isIntersecting ?? false;
        apply();
      },
      { threshold: 0.2 },
    );
    warm.observe(f);
    view.observe(f);
    document.addEventListener("visibilitychange", apply);
    return () => {
      warm.disconnect();
      view.disconnect();
      document.removeEventListener("visibilitychange", apply);
    };
  }, [video, frame, file]);
}
