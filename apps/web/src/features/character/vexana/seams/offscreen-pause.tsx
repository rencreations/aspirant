"use client";

import { useEffect } from "react";

/**
 * Sections far from the screen stop their CSS animations. The page has dozens of infinite ones (halos,
 * rings, sparks, twinkles, floats), and a running animation makes the browser work out the styles of
 * its element again on every frame, wherever it is: a long page with all of them running costs
 * several milliseconds a frame in style work alone, more on a slow machine. A section gets the
 * attribute `data-vx-off` while it is more than a screen or so away (an observer, so it is written
 * when a section crosses the line, never per frame), and `vexana-page.module.css` pauses everything
 * inside it. Within the margin the animations run as they always did, so nothing starts late in view.
 */
export function OffscreenPause() {
  useEffect(() => {
    const root = document.querySelector("[data-vexana]");
    if (!root || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          if (e.isIntersecting) el.removeAttribute("data-vx-off");
          else el.setAttribute("data-vx-off", "");
        }
      },
      { rootMargin: "100% 0px 100% 0px" },
    );
    const seen = new Set<Element>();
    const watch = () => {
      for (const s of root.querySelectorAll("section")) {
        if (seen.has(s)) continue;
        seen.add(s);
        io.observe(s);
      }
    };
    watch();
    // A section that mounts later (a lazy one) is watched too.
    const mo = new MutationObserver(watch);
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
      for (const s of seen) s.removeAttribute("data-vx-off");
    };
  }, []);
  return null;
}
