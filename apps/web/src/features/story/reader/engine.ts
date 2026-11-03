"use client";

/**
 * The reader's position on the page. One rAF-throttled scroll handler (no React state) that finds
 * the paragraph under the reading line by binary search over cached offsets, writes the position
 * into `useReadingPosition` only when a value changes, and saves the place (the chapter and the
 * paragraph) so the story can be continued from it. Offsets are measured again when the page
 * changes size (ResizeObserver), never per frame.
 */
import { useEffect, type RefObject } from "react";

import { chapters, getChapter } from "@/content/story";
import { useSiteStore } from "@/lib/stores";

import { useReadingPosition, type ReadingPosition } from "./position";
import { writePrefs } from "./prefs";

/** The reading line, as a fraction of the viewport height from the top. */
export const READING_LINE = 0.46;

/** The place is saved this long (ms) after the visitor stops on a paragraph. */
const SAVE_AFTER_MS = 1200;

const TOTAL_WORDS = chapters.reduce((sum, c) => sum + c.words, 0);

/** Words of the book before a chapter, for the progress of the whole story. */
function wordsBefore(id: string): number {
  let sum = 0;
  for (const c of chapters) {
    if (c.id === id) return sum;
    sum += c.words;
  }
  return 0;
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

export function useReadingEngine(rootRef: RefObject<HTMLElement | null>, chapterId: string) {
  useEffect(() => {
    const root = rootRef.current;
    const article = root?.querySelector<HTMLElement>("[data-chapter]");
    if (!root || !article) return;
    const entry = getChapter(chapterId);
    const before = wordsBefore(chapterId);
    const words = entry?.words ?? 1;

    let els: HTMLElement[] = [];
    let tops: number[] = [];
    let top = 0;
    let bottom = 1;
    let dirty = true;
    let raf = 0;
    let saveTimer = 0;
    let announced = false;

    const measure = () => {
      dirty = false;
      const y0 = window.scrollY;
      els = Array.from(article.querySelectorAll<HTMLElement>("[data-p]"));
      tops = els.map((el) => el.getBoundingClientRect().top + y0);
      const r = article.getBoundingClientRect();
      top = r.top + y0;
      bottom = r.bottom + y0;
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
      if (!els.length) return;
      const y = window.scrollY + window.innerHeight * READING_LINE;
      const at = lastAtOrBefore(tops, y);
      const paragraph = at >= 0 ? (els[at] ?? null) : null;
      const progress = Math.min(1, Math.max(0, (y - top) / Math.max(1, bottom - top)));
      write({
        chapterId,
        paragraphId: paragraph?.id ?? null,
        storyProgress: Math.round(((before + progress * words) / TOTAL_WORDS) * 10000) / 10000,
      });
      if (!announced) {
        announced = true;
        useSiteStore.getState().setLastChapter(chapterId);
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
    ro.observe(article);
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
  }, [rootRef, chapterId]);
}
