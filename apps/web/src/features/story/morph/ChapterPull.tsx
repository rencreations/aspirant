"use client";

/**
 * The pulls at both ends of a chapter. At the very bottom, a wheel, a finger or the scrolling keys
 * that try to go further build a pull: a small indicator says to keep scrolling, the card of the
 * next chapter leans in, and once the pull is full the card's morph starts. At the very top of a
 * chapter that has one before it, the same upward pull closes this title card into that chapter's
 * card (the way back). The listeners are passive; nothing is written per frame but the progress on
 * the indicator and the card.
 */
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef } from "react";

import { useTransitionRouter } from "@/components/transition/transition-provider";
import { chapterLabel } from "@/content/story";
import type { ChapterEntry } from "@/content/story-types";
import { isTypingTarget } from "@/lib/hooks";
import { OFFLINE_BLOCKED_EVENT } from "@/lib/offline";

import { chapterHref } from "../chapter-href";
import { useReader } from "../reader/reader-context";
import { dialogOpen } from "./Door";
import { findDoor } from "./doors";
import s from "./morph.module.css";
import { isMorphing, loadOverlay, startMorph } from "./morph-store";
import { PullMeter } from "./pull";
import { warmRoute } from "./warm";

const DOWN_KEYS = new Set(["PageDown", "ArrowDown", "End"]);
const UP_KEYS = new Set(["PageUp", "ArrowUp", "Home"]);

/** Pixels of a wheel event, whatever unit it came in. */
function wheelPixels(e: WheelEvent): number {
  if (e.deltaMode === 1) return e.deltaY * (100 / 6);
  if (e.deltaMode === 2) return e.deltaY * window.innerHeight;
  return e.deltaY;
}

function atBottom(): boolean {
  const el = document.documentElement;
  return window.scrollY + window.innerHeight >= el.scrollHeight - 1;
}

function atTop(): boolean {
  return window.scrollY <= 1;
}

export function ChapterPull({
  current,
  next,
  previous,
}: {
  current: ChapterEntry;
  next: ChapterEntry | null;
  previous: ChapterEntry | null;
}) {
  const router = useTransitionRouter();
  const { theme, textScale } = useReader();
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const nextKey = next ? next.id : "end";

  useEffect(() => {
    const down = new PullMeter();
    const up = new PullMeter();
    const bottomEl = bottomRef.current;
    const topEl = topRef.current;
    const previousHref = previous ? chapterHref(previous.id) : null;
    let raf = 0;
    let shownDown = false;
    let shownUp = false;
    let touchY: number | null = null;
    let fromDown = 0;
    let fromUp = 0;

    const show = (el: HTMLElement | null, on: boolean, offset: string) => {
      if (!el) return;
      el.style.opacity = on ? "1" : "0";
      el.style.transform = on ? "none" : offset;
    };

    const render = () => {
      raf = 0;
      const now = performance.now();
      const pd = down.tick(now);
      const pu = up.tick(now);
      const door = findDoor(nextKey)?.el;
      door?.style.setProperty("--pull", down.isLocked ? "1" : pd.toFixed(3));
      bottomEl?.style.setProperty("--p", pd.toFixed(3));
      topEl?.style.setProperty("--p", pu.toFixed(3));
      if (down.shown !== shownDown) {
        shownDown = down.shown;
        show(bottomEl, shownDown, "translateY(0.6rem)");
      }
      if (up.shown !== shownUp) {
        shownUp = up.shown;
        show(topEl, shownUp, "translateY(-0.6rem)");
      }
      if ((pd > 0 && !down.isLocked) || (pu > 0 && !up.isLocked))
        raf = requestAnimationFrame(render);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(render);
    };

    const goDown = (keyboard = false) => {
      const door = findDoor(nextKey);
      if (!door) {
        down.reset();
        return;
      }
      void door.start(keyboard).then((ok) => {
        if (!ok) down.reset();
        schedule();
      });
    };

    const goUp = async (keyboard = false) => {
      if (!previous || !previousHref) return;
      if (isMorphing() || router.isTransitioning() || dialogOpen()) {
        up.reset();
        return;
      }
      if (!router.canOpen(previousHref)) {
        window.dispatchEvent(new Event(OFFLINE_BLOCKED_EVENT));
        up.reset();
        return;
      }
      await warmRoute(previousHref, router.prefetch).ready;
      await loadOverlay();
      const ok = startMorph({
        kind: "back",
        entry: current,
        href: previousHref,
        theme,
        textScale,
        keyboard,
      });
      if (!ok) up.reset();
      schedule();
    };

    const blocked = () => isMorphing() || dialogOpen();

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || blocked()) return;
      const dy = wheelPixels(e);
      const now = performance.now();
      if (down.wheel(dy, now, atBottom())) goDown();
      if (previous) {
        // The first upward pull asks for the chapter before, so it is ready when the pull is.
        if (dy < 0 && atTop() && previousHref) warmRoute(previousHref, router.prefetch);
        if (up.wheel(-dy, now, atTop())) void goUp();
      }
      schedule();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || blocked() || isTypingTarget(e.target)) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t?.closest("button, [role='button'], input, select, textarea, [contenteditable]")) return;
      const now = performance.now();
      const toEnd = DOWN_KEYS.has(e.key) || (e.key === " " && !e.shiftKey);
      const toTop = UP_KEYS.has(e.key) || (e.key === " " && e.shiftKey);
      if (toEnd && down.key(now, atBottom())) goDown(true);
      if (toTop && previous && up.key(now, atTop())) void goUp(true);
      schedule();
    };

    const onTouchStart = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      touchY = y ?? null;
      fromDown = y ?? 0;
      fromUp = y ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (y === undefined || touchY === null || blocked()) return;
      const now = performance.now();
      // The distance counts from where the finger was when the page reached its end.
      if (!atBottom()) fromDown = y;
      if (!atTop()) fromUp = y;
      if (down.touch(fromDown - y, now, atBottom())) goDown();
      if (previous && up.touch(y - fromUp, now, atTop())) void goUp();
      schedule();
    };
    const onTouchEnd = () => {
      touchY = null;
      const now = performance.now();
      down.release(now);
      up.release(now);
      schedule();
    };

    const onScroll = () => {
      const now = performance.now();
      down.edge(atBottom(), now);
      up.edge(atTop(), now);
      schedule();
    };

    onScroll();
    const passive = { passive: true } as const;
    window.addEventListener("wheel", onWheel, passive);
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, passive);
    window.addEventListener("touchmove", onTouchMove, passive);
    window.addEventListener("touchend", onTouchEnd, passive);
    window.addEventListener("touchcancel", onTouchEnd, passive);
    window.addEventListener("scroll", onScroll, passive);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("scroll", onScroll);
    };
  }, [current, nextKey, previous, router, textScale, theme]);

  return (
    <>
      <div
        ref={bottomRef}
        className={`${s.pull} ${s.pullBottom}`}
        data-theme={theme}
        data-pull="down"
        aria-hidden="true"
      >
        <span className={s.pullRow}>
          <ChevronDown className={s.pullChevron} size={14} strokeWidth={1.75} />
          <span>Keep scrolling</span>
          <span className={s.pullWhere}>{next ? chapterLabel(next) : "The end"}</span>
        </span>
        <span className={s.pullLine}>
          <span className={s.pullFill} />
        </span>
      </div>
      {previous && (
        <div ref={topRef} className={`${s.pull} ${s.pullTop}`} data-pull="up" aria-hidden="true">
          <span className={s.pullRow}>
            <ChevronUp className={s.pullChevron} size={14} strokeWidth={1.75} />
            <span>Keep scrolling up</span>
            <span className={s.pullWhere}>{chapterLabel(previous)}</span>
          </span>
          <span className={s.pullLine}>
            <span className={s.pullFill} />
          </span>
        </div>
      )}
    </>
  );
}
