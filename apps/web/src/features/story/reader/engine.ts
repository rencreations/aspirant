"use client";

/**
 * The reader's position on the page. One rAF-throttled scroll handler (no React state) that finds
 * the chapter under the reading line by binary search over cached offsets, then the paragraph
 * inside it, writes the position into `useReadingPosition` only when a value changes, and saves
 * the place (the chapter and the paragraph) so the story can be continued from it. Nothing on the
 * page changes with the position: the text stays plain.
 * Offsets are measured again when the page changes size (ResizeObserver), never per frame.
 */
import { useEffect, type RefObject } from "react";

import { useSiteStore } from "@/lib/stores";

import { useReadingPosition, type ReadingPosition } from "./position";
import { writePrefs } from "./prefs";
import { getUnit, TOTAL_PARAGRAPHS } from "./story-data";

/** The reading line, as a fraction of the viewport height from the top. */
export const READING_LINE = 0.46;

/** The place is saved this long (ms) after the visitor stops on a paragraph. */
const SAVE_AFTER_MS = 1200;

interface ChapterBox {
  readonly el: HTMLElement;
  readonly chapterId: string;
  top: number;
  bottom: number;
}

interface ParaCache {
  readonly els: HTMLElement[];
  readonly tops: number[];
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

type PositionPatch = Parameters<ReadingPosition["setPosition"]>[0];

export function useReadingEngine(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let boxes: ChapterBox[] = [];
    let tops: number[] = [];
    let dirty = true;
    let raf = 0;
    let saveTimer = 0;
    let lastChapter: string | null = null;
    const paraCache = new Map<string, ParaCache>();

    const measure = () => {
      dirty = false;
      paraCache.clear();
      const y0 = window.scrollY;
      boxes = Array.from(root.querySelectorAll<HTMLElement>("[data-chapter]")).map((el) => {
        const r = el.getBoundingClientRect();
        return { el, chapterId: el.dataset.chapter ?? "", top: r.top + y0, bottom: r.bottom + y0 };
      });
      tops = boxes.map((b) => b.top);
    };

    const paragraphsOf = (box: ChapterBox): ParaCache => {
      const hit = paraCache.get(box.chapterId);
      if (hit) return hit;
      const y0 = window.scrollY;
      const els = Array.from(box.el.querySelectorAll<HTMLElement>("[data-p]"));
      const cache = { els, tops: els.map((el) => el.getBoundingClientRect().top + y0) };
      paraCache.set(box.chapterId, cache);
      return cache;
    };

    const save = () => {
      saveTimer = 0;
      const pos = useReadingPosition.getState();
      if (pos.chapterId && pos.paragraphId)
        writePrefs({ chapterId: pos.chapterId, paragraphId: pos.paragraphId });
    };

    const write = (patch: PositionPatch) => {
      const state = useReadingPosition.getState();
      const changed = (Object.keys(patch) as Array<keyof PositionPatch>).some(
        (key) => state[key] !== patch[key],
      );
      if (changed) state.setPosition(patch);
    };

    const frame = () => {
      raf = 0;
      if (dirty) measure();
      if (!boxes.length) return;
      const y = window.scrollY + window.innerHeight * READING_LINE;
      const index = lastAtOrBefore(tops, y);
      const box = index >= 0 ? boxes[index] : undefined;
      if (!box) {
        // Above the first chapter: the Part's own heading.
        write({ chapterId: null, paragraphId: null });
        return;
      }
      const inside = y <= box.bottom;
      const cache = paragraphsOf(box);
      const at = inside ? lastAtOrBefore(cache.tops, y) : -1;
      const paragraph = cache.els[at] ?? null;
      const progress = Math.min(1, Math.max(0, (y - box.top) / Math.max(1, box.bottom - box.top)));
      const meta = getUnit(box.chapterId);
      const storyProgress = meta
        ? Math.min(
            1,
            (meta.firstParagraphIndex + progress * meta.paragraphCount) / TOTAL_PARAGRAPHS,
          )
        : 0;
      write({
        chapterId: box.chapterId,
        paragraphId: paragraph?.id ?? null,
        storyProgress: Math.round(storyProgress * 10000) / 10000,
      });
      if (box.chapterId !== lastChapter) {
        lastChapter = box.chapterId;
        useSiteStore.getState().setLastChapter(box.chapterId);
      }
      if (paragraph && !saveTimer) saveTimer = window.setTimeout(save, SAVE_AFTER_MS);
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const invalidate = () => {
      dirty = true;
      schedule();
    };
    // The visitor leaves (a link, a closed tab): keep the place they have reached.
    const flush = () => {
      if (document.visibilityState === "hidden" && saveTimer) {
        window.clearTimeout(saveTimer);
        save();
      }
    };

    const ro = new ResizeObserver(invalidate);
    ro.observe(root);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", invalidate, { passive: true });
    document.addEventListener("visibilitychange", flush);
    void document.fonts?.ready.then(invalidate);
    schedule();

    return () => {
      cancelAnimationFrame(raf);
      if (saveTimer) {
        window.clearTimeout(saveTimer);
        save();
      }
      ro.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", invalidate);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [rootRef]);
}
