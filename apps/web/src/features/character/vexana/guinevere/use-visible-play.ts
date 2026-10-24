"use client";

import { useEffect, type RefObject } from "react";

import { useReducedMotion } from "@/lib/hooks";
import { mediaUrl } from "@/lib/media-store";
import { perfLevel } from "@/lib/perf";

/** A muted picture may run by itself, but not on the light level or with data saving on. */
function mayPlay() {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return perfLevel() !== "lite" && nav.connection?.saveData !== true;
}

/**
 * Plays a muted looping video only while its frame is on screen. It gets its source when the
 * frame is first close to the screen (the preloaded copy if there is one), and it pauses when the
 * frame leaves, the tab is hidden, or the visitor asks for reduced motion.
 */
export function useVisiblePlay(
  video: RefObject<HTMLVideoElement | null>,
  frame: RefObject<HTMLElement | null>,
  file: string,
) {
  const reduced = useReducedMotion();
  useEffect(() => {
    const v = video.current;
    const f = frame.current;
    if (!v || !f) return;
    let near = false;
    let seen = false;
    const apply = () => {
      if (near && seen && !reduced && mayPlay()) {
        if (v.paused) void v.play().catch(() => undefined);
      } else if (!v.paused) {
        v.pause();
      }
    };
    const warm = new IntersectionObserver(
      ([e]) => {
        near = e?.isIntersecting ?? false;
        if (near && !v.getAttribute("src")) {
          v.src = mediaUrl(file);
          v.load();
        }
        apply();
      },
      { rootMargin: "60% 0px 60% 0px" },
    );
    const view = new IntersectionObserver(
      ([e]) => {
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
  }, [video, frame, file, reduced]);
}
