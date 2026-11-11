"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { useIsoLayoutEffect } from "@/lib/hooks";

import {
  metricsFor,
  needsRebuild,
  overscanFor,
  rowOfPicture,
  rowShift,
  scrollForPicture,
  scrollToShow,
  visibleRows,
  type FlowMetrics,
  type FlowRow,
  type FlowScroll,
} from "./math";
import { largeViewportHeight } from "./viewport";

/**
 * The size the rows are planned for: the width of their box and the large viewport height. The
 * plan is made again when the width changes, and when the height changes a lot (a turned phone),
 * not for the few percent a phone's address bar takes.
 */
export function useFlowMetrics(boxRef: RefObject<HTMLElement | null>): FlowMetrics | null {
  const [metrics, setMetrics] = useState<FlowMetrics | null>(null);
  const built = useRef<FlowMetrics | null>(null);

  useIsoLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let timer = 0;
    const measure = () => {
      const vw = box.clientWidth;
      if (vw <= 0) return;
      const vh = largeViewportHeight();
      if (needsRebuild(built.current, vw, vh)) {
        built.current = metricsFor(vw, vh);
        setMetrics(built.current);
      }
    };
    // The first measure is at once; a window being dragged is measured when it rests.
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, 150);
    };
    measure();
    const observer = new ResizeObserver(later);
    observer.observe(box);
    window.addEventListener("resize", later, { passive: true });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", later);
    };
  }, [boxRef]);

  return metrics;
}

interface Placed {
  el: HTMLElement;
  row: FlowRow;
  m: FlowMetrics;
  /** The shift last written, so a row that has not moved (one far off the screen) is not written again. */
  x: number;
}

export interface FlowEngine {
  /** The rows that stand in the page now: `[first, last]`, inclusive. `[0, -1]` for none. */
  range: readonly [number, number];
  /** Pass the row's element and model to this from a ref callback: the row is placed at once and then follows the scroll. */
  place: (el: HTMLElement | null, row: FlowRow, m: FlowMetrics) => void;
  /** The row is on the screen now, as the page is scrolled. */
  onScreen: (row: FlowRow) => boolean;
  /**
   * Scroll the page so picture `index` (of the list) shows. By default it comes to the middle of
   * the screen; with `near` the page moves only as far as the row's slide needs (for a keyboard
   * focus). False when the picture is not in the rows.
   */
  reveal: (index: number, near?: boolean) => boolean;
}

/**
 * Moves the rows with the scroll. The page's scroll event (and Lenis, which the page scrolls
 * with, in the same frame) writes `translate3d` on the rows that stand in the page and nothing
 * else: no layout is read per scroll, because where a row is and how far it has slid come from
 * the rows' own maths. Which rows stand in the page (`range`) is state and changes only when the
 * scroll crosses into a new row, so React works once in a few hundred pixels, not once a frame.
 */
export function useFlowEngine(options: {
  boxRef: RefObject<HTMLElement | null>;
  rows: readonly FlowRow[];
  metrics: FlowMetrics | null;
}): FlowEngine {
  const { boxRef, rows, metrics } = options;
  const { getLenis } = useLenis();
  const [range, setRange] = useState<readonly [number, number]>([0, -1]);
  const rangeRef = useRef<readonly [number, number]>([0, -1]);
  const placed = useRef(new Map<number, Placed>());
  const state = useRef({ y: Number.NaN, boxTop: 0, maxScroll: 0, dpr: 1 });
  const latest = useRef<{ rows: readonly FlowRow[]; metrics: FlowMetrics | null }>({
    rows,
    metrics,
  });
  // The row in the middle of the screen before the plan changed, to keep it there afterwards.
  const anchor = useRef<{ picture: number; screenY: number } | null>(null);

  const measure = useCallback(() => {
    const box = boxRef.current;
    if (!box) return;
    const s = state.current;
    s.boxTop = box.getBoundingClientRect().top + window.scrollY;
    const root = document.documentElement;
    s.maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
    s.dpr = window.devicePixelRatio || 1;
  }, [boxRef]);

  const scrollOf = useCallback((y: number): FlowScroll => {
    const s = state.current;
    return { y, boxTop: s.boxTop, maxScroll: s.maxScroll };
  }, []);

  const apply = useCallback(
    (force: boolean) => {
      const { rows: all, metrics: m } = latest.current;
      if (!m) return;
      const y = window.scrollY;
      const s = state.current;
      if (!force && Math.abs(y - s.y) < 0.01) return;
      s.y = y;
      const next = visibleRows(y, s.boxTop, m.vh, all.length, m, overscanFor(m.vh));
      const prev = rangeRef.current;
      if (next[0] !== prev[0] || next[1] !== prev[1]) {
        rangeRef.current = next;
        setRange(next);
      }
      const scroll = scrollOf(y);
      placed.current.forEach((p) => {
        const x = rowShift(p.row, p.m, scroll, s.dpr);
        if (x === p.x) return;
        p.x = x;
        p.el.style.transform = `translate3d(${x}px,0,0)`;
      });
    },
    [scrollOf],
  );

  const place = useCallback(
    (el: HTMLElement | null, row: FlowRow, m: FlowMetrics) => {
      if (!el) {
        placed.current.delete(row.index);
        return;
      }
      const s = state.current;
      const y = Number.isNaN(s.y) ? window.scrollY : s.y;
      const x = rowShift(row, m, scrollOf(y), s.dpr);
      placed.current.set(row.index, { el, row, m, x });
      el.style.transform = `translate3d(${x}px,0,0)`;
    },
    [scrollOf],
  );

  const scrollTo = useCallback(
    (y: number) => {
      const lenis = getLenis();
      if (lenis) {
        // Lenis keeps the page's length from its last measure and stops a jump at that: the rows
        // may have just made the page longer, so it measures again first.
        lenis.resize();
        lenis.scrollTo(y, { immediate: true, force: true });
      } else window.scrollTo(0, y);
    },
    [getLenis],
  );

  const reveal = useCallback(
    (index: number, near = false): boolean => {
      const { rows: all, metrics: m } = latest.current;
      if (!m) return false;
      const at = rowOfPicture(all, index);
      const row = all[at];
      if (!row) return false;
      const s = state.current;
      const k = index - row.start;
      scrollTo(
        near
          ? scrollToShow(row, k, m, s.boxTop, s.maxScroll, window.scrollY)
          : scrollForPicture(row, k, m, s.boxTop, s.maxScroll),
      );
      return true;
    },
    [scrollTo],
  );

  const onScreen = useCallback((row: FlowRow): boolean => {
    const m = latest.current.metrics;
    if (!m) return false;
    const top = state.current.boxTop + row.top - window.scrollY;
    return top + m.rowH > 0 && top < m.vh;
  }, []);

  // The row in the middle of the screen, noted while the plan is the old one.
  useIsoLayoutEffect(() => {
    const { rows: old, metrics: m } = latest.current;
    if (!m || old.length === 0) {
      anchor.current = null;
      return;
    }
    const s = state.current;
    const pitch = m.rowH + m.gap;
    const middle = window.scrollY + m.vh / 2 - s.boxTop;
    const row = old[Math.min(old.length - 1, Math.max(0, Math.floor(middle / pitch)))];
    anchor.current = row
      ? { picture: row.start, screenY: s.boxTop + row.top + m.rowH / 2 - window.scrollY }
      : null;
  }, [metrics]);

  // New rows (a filter, a resize): measure the box again and place everything before the paint.
  useIsoLayoutEffect(() => {
    const before = latest.current.metrics;
    latest.current = { rows, metrics };
    measure();
    const a = anchor.current;
    anchor.current = null;
    // A new width keeps the same picture where it was on the screen.
    if (a && before && metrics && before.vw !== metrics.vw) {
      const row = rows[rowOfPicture(rows, a.picture)];
      if (row) {
        const s = state.current;
        const y = s.boxTop + row.top + metrics.rowH / 2 - a.screenY;
        const clamped = Math.min(Math.max(0, y), s.maxScroll);
        if (Math.abs(clamped - window.scrollY) > 1) scrollTo(clamped);
      }
    }
    apply(true);
  }, [rows, metrics, measure, apply, scrollTo]);

  // What stands above the rows can change height (the chips wrap): the box's top is measured again.
  useEffect(() => {
    const root = boxRef.current?.parentElement;
    if (!root) return;
    const observer = new ResizeObserver(() => {
      measure();
      apply(true);
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
    };
  }, [boxRef, measure, apply]);

  useEffect(() => {
    const onScroll = () => {
      apply(false);
    };
    const lenis = getLenis();
    const off = lenis?.on("scroll", onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      off?.();
      window.removeEventListener("scroll", onScroll);
    };
  }, [apply, getLenis]);

  return { range, place, reveal, onScreen };
}
