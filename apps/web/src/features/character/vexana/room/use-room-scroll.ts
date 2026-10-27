"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { ARM_AT, CANCEL_BELOW, meters, recentInput, trackProgress } from "./scroll-math";

/** The last stretch is held this long before the page goes on, so a bounce does not trigger it. */
const LOCK_MS = 520;

interface Options {
  /** Reduced motion: the meters show, but nothing goes on by itself. */
  reduced: boolean;
  /** The page goes on (to the next character). */
  go: () => void;
}

/**
 * Reads how far the visitor has scrolled through the room's track and runs the two meters (see
 * `scroll-math.ts`). The meters are written as `--strength` and `--ahead` on the room's screen (an
 * element of its own, never the page), only while the page scrolls. Returns whether the
 * information bar about the next character is up. At the end of the track the page goes on once the
 * visitor has stayed there for a moment; scrolling back up cancels it.
 */
export function useRoomScroll(
  track: RefObject<HTMLElement | null>,
  screen: RefObject<HTMLElement | null>,
  { reduced, go }: Options,
): boolean {
  const [bar, setBar] = useState(false);
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  }, [go]);

  useEffect(() => {
    const el = track.current;
    const box = screen.current;
    if (!el || !box) return;
    let raf = 0;
    let lock = 0;
    let open = false;
    // Only the visitor's own scrolling may take the page on: see `recentInput`.
    let lastInput = -Infinity;
    const touch = () => {
      lastInput = performance.now();
    };
    const progress = () => {
      const r = el.getBoundingClientRect();
      return trackProgress(r.top, r.height, window.innerHeight);
    };
    const read = () => {
      raf = 0;
      const p = progress();
      const m = meters(p, open);
      box.style.setProperty("--strength", m.strength.toFixed(3));
      box.style.setProperty("--ahead", m.ahead.toFixed(3));
      if (m.bar !== open) {
        open = m.bar;
        setBar(open);
      }
      if (reduced) return;
      if (p >= ARM_AT && !lock) {
        lock = window.setTimeout(() => {
          lock = 0;
          if (progress() >= CANCEL_BELOW && recentInput(performance.now(), lastInput))
            goRef.current();
        }, LOCK_MS);
      } else if (p < CANCEL_BELOW && lock) {
        window.clearTimeout(lock);
        lock = 0;
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    const inputs = ["wheel", "touchstart", "touchmove", "keydown", "pointerdown"] as const;
    for (const type of inputs) window.addEventListener(type, touch, { passive: true });
    return () => {
      for (const type of inputs) window.removeEventListener(type, touch);
      cancelAnimationFrame(raf);
      window.clearTimeout(lock);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [track, screen, reduced]);

  return bar;
}
