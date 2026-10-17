"use client";

/**
 * The narrator's position. One rAF-throttled scroll handler (no React state) that:
 * - finds the unit (opening, Part card, chapter, held beat, end) under the reading line by
 *   binary search over cached offsets, then the paragraph inside it;
 * - lights that paragraph (`data-lit`) and dims the rest through CSS;
 * - writes the position into `useExperience` only when a value changes;
 * - sets the page mood, preloads the next Part at 70 percent, saves the position, and
 *   calibrates the height estimate used by not yet loaded chapters.
 * Offsets are re-measured when the book's size changes (ResizeObserver), never per frame.
 */
import { useEffect, type RefObject } from "react";

import { useSiteStore } from "@/lib/stores";

import { useExperience, type PartNumber } from "../contract";
import { ensurePart } from "./book-store";
import { READING_LINE } from "./observers";
import { writePrefs } from "./prefs";
import { getPartMeta, getUnit, TOTAL_PARAGRAPHS, toPartNumber } from "./story-data";

type UnitKind = "opening" | "part" | "chapter" | "beat" | "end";

interface UnitBox {
  readonly el: HTMLElement;
  readonly kind: UnitKind;
  readonly part: number | null;
  readonly chapterId: string | null;
  readonly mood: string;
  top: number;
  bottom: number;
}

interface ParaCache {
  readonly els: HTMLElement[];
  readonly tops: number[];
}

/** Base height model for chapters that are not rendered yet (px per word, px per paragraph). */
export interface Metrics {
  ppw: number;
  ppp: number;
}

/** First guess from the column width and the type size; calibrated against real chapters. */
export function baseMetrics(columnPx: number, fontPx: number, linePx: number, gapPx: number): Metrics {
  const wordEm = 2.62; // about 5.85 characters per word, 0.448 em each in Instrument Serif
  const wordsPerLine = Math.max(3, columnPx / (wordEm * fontPx));
  return { ppw: linePx / wordsPerLine, ppp: linePx * 0.5 + gapPx };
}

function lastAtOrBefore(values: readonly number[], y: number): number {
  let lo = 0;
  let hi = values.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((values[mid] ?? Infinity) <= y) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

export function useReadingEngine(rootRef: RefObject<HTMLElement | null>, probeRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let units: UnitBox[] = [];
    let tops: number[] = [];
    let dirty = true;
    let raf = 0;
    const paraCache = new Map<string, ParaCache>();
    let litEl: HTMLElement | null = null;
    let mood = "";
    let lastChapter: string | null = null;
    let saveTimer = 0;
    let metrics: Metrics = { ppw: 0, ppp: 0 };
    let metricsKey = "";
    const samples = new Map<string, { actual: number; w: number; p: number }>();

    const measureMetrics = () => {
      const probe = probeRef.current;
      if (!probe) return;
      const css = getComputedStyle(probe);
      const font = parseFloat(css.fontSize) || 20;
      const line = parseFloat(css.lineHeight) || font * 1.55;
      const gap = parseFloat(css.marginBottom) || font * 0.85;
      const width = probe.clientWidth || 640;
      const key = `${Math.round(width)}:${font.toFixed(2)}`;
      if (key === metricsKey) return;
      metricsKey = key;
      samples.clear();
      metrics = baseMetrics(width, font, line, gap);
      applyMetrics();
    };

    const applyMetrics = () => {
      root.style.setProperty("--ppw", `${metrics.ppw.toFixed(3)}px`);
      root.style.setProperty("--ppp", `${metrics.ppp.toFixed(2)}px`);
    };

    const calibrate = (box: UnitBox) => {
      if (box.kind !== "chapter" || !box.chapterId || samples.has(box.chapterId)) return;
      const body = box.el.querySelector<HTMLElement>("[data-body]");
      const meta = getUnit(box.chapterId);
      if (!body || !meta) return;
      const rect = body.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      samples.set(box.chapterId, {
        actual: rect.height,
        w: meta.wordCount,
        p: meta.paragraphCount,
      });
      let sumW = 0;
      let rest = 0;
      for (const sample of samples.values()) {
        sumW += sample.w;
        rest += sample.actual - sample.p * metrics.ppp;
      }
      const ppw = rest / Math.max(1, sumW);
      if (ppw > 0 && Math.abs(ppw / metrics.ppw - 1) > 0.03) {
        metrics = { ...metrics, ppw };
        applyMetrics();
      }
    };

    const measure = () => {
      dirty = false;
      paraCache.clear();
      const y0 = window.scrollY;
      units = Array.from(root.querySelectorAll<HTMLElement>("[data-unit]")).map((el) => {
        const r = el.getBoundingClientRect();
        const part = el.dataset.part ? Number(el.dataset.part) : null;
        return {
          el,
          kind: (el.dataset.unit ?? "chapter") as UnitKind,
          part,
          chapterId: el.dataset.chapter ?? null,
          mood: el.dataset.mood ?? "storm",
          top: r.top + y0,
          bottom: r.bottom + y0,
        };
      });
      tops = units.map((u) => u.top);
    };

    const paragraphsOf = (box: UnitBox): ParaCache => {
      const id = box.chapterId ?? "";
      const hit = paraCache.get(id);
      if (hit) return hit;
      const y0 = window.scrollY;
      const els = Array.from(box.el.querySelectorAll<HTMLElement>("[data-p]"));
      const cache = { els, tops: els.map((el) => el.getBoundingClientRect().top + y0) };
      paraCache.set(id, cache);
      return cache;
    };

    const partSpan = (n: number) => {
      let first = Infinity;
      let last = -Infinity;
      for (const u of units) {
        if (u.part !== n) continue;
        first = Math.min(first, u.top);
        last = Math.max(last, u.bottom);
      }
      return { first, last };
    };

    const write = (patch: Parameters<ReturnType<typeof useExperience.getState>["setPosition"]>[0]) => {
      const state = useExperience.getState();
      const changed = (Object.keys(patch) as Array<keyof typeof patch>).some(
        (key) => state[key] !== patch[key],
      );
      if (changed) state.setPosition(patch);
    };

    const frame = () => {
      raf = 0;
      if (dirty) {
        measureMetrics();
        measure();
      }
      if (!units.length) return;
      const vh = window.innerHeight;
      const y = window.scrollY + vh * READING_LINE;
      const index = Math.max(0, lastAtOrBefore(tops, y));
      const box = units[index];
      if (!box) return;

      if (box.mood !== mood) {
        mood = box.mood;
        root.dataset.mood = mood;
      }

      let paragraph: HTMLElement | null = null;
      let chapterId: string | null = box.chapterId;
      let progress = 0;
      if (box.kind === "chapter") {
        progress = Math.min(1, Math.max(0, (y - box.top) / Math.max(1, box.bottom - box.top)));
        const cache = paragraphsOf(box);
        const at = lastAtOrBefore(cache.tops, y);
        paragraph = cache.els[at] ?? null;
        calibrate(box);
      } else if (box.kind === "part") {
        chapterId = box.part ? (getPartMeta(box.part)?.chapterIds[0] ?? null) : null;
      } else if (box.kind === "beat" || box.kind === "end") {
        progress = 1;
      }

      if (paragraph !== litEl) {
        litEl?.removeAttribute("data-lit");
        paragraph?.setAttribute("data-lit", "");
        litEl = paragraph;
      }

      const meta = chapterId ? getUnit(chapterId) : undefined;
      const storyProgress =
        box.kind === "opening"
          ? 0
          : box.kind === "end"
            ? 1
            : meta
              ? Math.min(
                  1,
                  (meta.firstParagraphIndex + progress * meta.paragraphCount) / TOTAL_PARAGRAPHS,
                )
              : useExperience.getState().storyProgress;
      write({
        partNumber: box.part ? (toPartNumber(box.part) satisfies PartNumber) : null,
        chapterId,
        chapterProgress: Math.round(progress * 1000) / 1000,
        paragraphId: paragraph?.id ?? (box.kind === "chapter" ? useExperience.getState().paragraphId : null),
        storyProgress: Math.round(storyProgress * 10000) / 10000,
      });

      // Preload the next Part once this one is 70 percent read.
      if (box.part && box.part < 12) {
        const span = partSpan(box.part);
        if (span.last > span.first && (y - span.first) / (span.last - span.first) >= 0.7)
          void ensurePart(box.part + 1);
      }

      if (chapterId && box.kind === "chapter" && chapterId !== lastChapter) {
        lastChapter = chapterId;
        useSiteStore.getState().setLastChapter(chapterId);
      }
      if (paragraph && !saveTimer) {
        saveTimer = window.setTimeout(() => {
          saveTimer = 0;
          const pos = useExperience.getState();
          if (pos.chapterId && pos.paragraphId)
            writePrefs({ chapterId: pos.chapterId, paragraphId: pos.paragraphId });
        }, 1200);
      }
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const invalidate = () => {
      dirty = true;
      schedule();
    };
    const onResize = () => {
      metricsKey = "";
      invalidate();
    };

    const ro = new ResizeObserver(invalidate);
    ro.observe(root);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    void document.fonts?.ready.then(onResize);
    schedule();

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(saveTimer);
      ro.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
      litEl?.removeAttribute("data-lit");
    };
  }, [rootRef, probeRef]);
}
