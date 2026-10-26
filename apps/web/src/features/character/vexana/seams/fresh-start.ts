"use client";

import { useLayoutEffect } from "react";

let done = false;

/**
 * A page of held sections cannot be reopened half way down by the browser: the joins are made by the
 * layout, and a restored position lands in the middle of one (and the loading screen has the
 * visitor back at the film, whatever they were reading). So a reload starts at the top. Only the
 * first mount of a document does it: coming back to the page by the back button is left to the
 * router, which restores the place.
 */
export function useFreshStart(): void {
  useLayoutEffect(() => {
    if (done || typeof window === "undefined") return;
    done = true;
    const entry = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    if (entry?.type !== "reload") return;
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);
}
