"use client";

import { useEffect, useRef } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { useReducedMotion } from "@/lib/hooks";

/** A stretch of the page, in scroll pixels, over which a transition is drawn. */
export interface SnapRange {
  start: number;
  end: number;
}

interface SnapOptions {
  /** Quiet time, in ms, after which the transition finishes by itself. Default 1500. */
  idleMs?: number;
  enabled?: boolean;
  /** Seconds the page takes to scroll to the end it snaps to. Default 0.9. */
  snapSeconds?: number;
  /**
   * Called when the quiet time is over, with the end the progress is nearer to. Return true when
   * you handled it yourself (a transition that plays by itself instead of scrolling); otherwise the
   * page scrolls to that end.
   */
  onSnap?: (target: "start" | "end") => boolean | void;
}

const INPUTS = ["wheel", "touchstart", "touchmove", "keydown", "pointerdown"] as const;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
/** Scroll animation of a snap, in seconds. */
const SNAP_SECONDS = 0.9;
/** The page must have been still this long (ms) before a snap starts. */
const STILL_MS = 120;

/** The end the progress is nearer to (a half goes on). The range may run backwards (end < start). */
function snapSide(range: SnapRange, y: number): "start" | "end" {
  const p = (y - range.start) / (range.end - range.start);
  return p >= 0.5 ? "end" : "start";
}

/**
 * Makes a stretch of the page one that the visitor can never stop in. When the visitor has not
 * given an input (wheel, touch, key) for `idleMs` inside `getRange()` and the page has stopped
 * moving, the page scrolls by itself to the
 * nearer end: the far end when they are half way or more (the transition finishes), the near one
 * otherwise (the transition is taken back). It works the same going down and going up. Any new
 * input stops the snap and starts the wait again. Reduced motion: no snapping.
 */
export function useScrollSnap(id: string, getRange: () => SnapRange | null, opts?: SnapOptions) {
  const { getLenis } = useLenis();
  const reduced = useReducedMotion();
  const enabled = (opts?.enabled ?? true) && !reduced;
  const idleMs = opts?.idleMs ?? 1500;
  const seconds = opts?.snapSeconds ?? SNAP_SECONDS;
  const rangeRef = useRef(getRange);
  const lenisRef = useRef(getLenis);
  const onSnapRef = useRef(opts?.onSnap);
  useEffect(() => {
    rangeRef.current = getRange;
    lenisRef.current = getLenis;
    onSnapRef.current = opts?.onSnap;
  });

  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    let snapping = false;
    /** When the page last moved: a snap waits until it has been still for a moment. */
    let lastScroll = 0;

    const clear = () => {
      window.clearTimeout(timer);
      timer = 0;
    };

    const stopSnap = () => {
      if (!snapping) return;
      snapping = false;
      const lenis = lenisRef.current();
      // Cancels the scroll animation where it is.
      if (lenis) lenis.scrollTo(lenis.scroll, { immediate: true, force: true });
    };

    // Strictly inside, with a pixel to spare at both ends: the page rounds its scroll position, so a
    // snap that has landed on an end can sit a fraction of a pixel inside it and must not snap again.
    const inside = (y: number, r: SnapRange | null): r is SnapRange =>
      r !== null &&
      r.end !== r.start &&
      y > Math.min(r.start, r.end) + 1 &&
      y < Math.max(r.start, r.end) - 1;

    const snapNow = () => {
      timer = 0;
      // Still gliding (the smooth scroller, a touch fling): look again in a moment.
      if (performance.now() - lastScroll < STILL_MS) {
        timer = window.setTimeout(snapNow, STILL_MS);
        return;
      }
      const y = window.scrollY;
      const r = rangeRef.current();
      if (!inside(y, r)) return;
      const side = snapSide(r, y);
      if (onSnapRef.current?.(side) === true) return;
      const lenis = lenisRef.current();
      if (!lenis) return;
      const target = side === "end" ? r.end : r.start;
      snapping = true;
      lenis.scrollTo(target, {
        duration: seconds,
        easing: easeOut,
        force: true,
        onComplete: () => {
          snapping = false;
          // If the layout moved while the page scrolled (a resize, pictures arriving), it can stop a
          // little short of the end: look again, and snap again if it is still inside the stretch.
          evaluate();
        },
      });
    };

    const evaluate = () => {
      const y = window.scrollY;
      const r = rangeRef.current();
      if (!inside(y, r)) {
        clear();
        return;
      }
      // The wait is counted from the last INPUT (the wheel, a touch, a key: `onInput` below). The page
      // moves for a while after it (the smooth scroller glides), and that movement must not push the
      // snap back: it would come after a second and a half or more, not after the one the visitor
      // is promised. A scroll that no input caused (a jump) starts the wait if none is running.
      if (!snapping && !timer) timer = window.setTimeout(snapNow, idleMs);
    };

    const onScroll = () => {
      lastScroll = performance.now();
      evaluate();
    };
    const onInput = () => {
      stopSnap();
      clear();
      // A new input in the stretch starts the wait again from this moment.
      if (inside(window.scrollY, rangeRef.current())) timer = window.setTimeout(snapNow, idleMs);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    for (const e of INPUTS) window.addEventListener(e, onInput, { passive: true });
    evaluate();
    return () => {
      window.removeEventListener("scroll", onScroll);
      for (const e of INPUTS) window.removeEventListener(e, onInput);
      clear();
      stopSnap();
    };
  }, [enabled, id, idleMs, seconds]);
}
