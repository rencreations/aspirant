"use client";

import { useEffect } from "react";

import { coveredBySection, samplePoints } from "./occlusion";

/** How often a playing video is looked at (the page does nothing heavier than a hit test). */
const TICK_MS = 250;
/** A video must look covered this many times in a row before it is paused (a scene passing over). */
const COVERED_TICKS = 2;
/** The game and the room run their own videos and their own rest. */
const SKIP = "#drama, #room, [role='dialog']";

/**
 * Pauses a video that another section lies over and starts it again when it is uncovered. It only
 * starts the ones it stopped itself, so a video the visitor paused stays paused. Mount once on the
 * long page (it renders nothing).
 */
export function VideoOcclusion() {
  useEffect(() => {
    const root = document.querySelector("[data-vexana]");
    if (!root) return;
    const mine = new WeakSet<HTMLVideoElement>();
    const count = new WeakMap<HTMLVideoElement, number>();
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      for (const v of root.querySelectorAll("video")) {
        if (v.closest(SKIP)) continue;
        const playing = !v.paused && !v.ended;
        if (!playing && !mine.has(v)) continue;
        const pts = samplePoints(v.getBoundingClientRect(), vw, vh);
        const hits = pts.map(([x, y]) => document.elementFromPoint(x, y));
        const covered = coveredBySection(v, hits);
        if (playing && covered) {
          const n = (count.get(v) ?? 0) + 1;
          count.set(v, n);
          if (n >= COVERED_TICKS) {
            mine.add(v);
            v.pause();
          }
        } else if (!covered) {
          count.set(v, 0);
          if (mine.has(v)) {
            mine.delete(v);
            if (v.paused && v.getAttribute("src") && v.readyState > 0)
              void v.play().catch(() => undefined);
          }
        }
      }
    };
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  return null;
}
