import type Lenis from "lenis";

import { isScrollKey } from "@/features/character/vexana/seams/scroll-lock";

/**
 * A hold on the page's scrolling in one direction only: the page may not go DOWN past a line, and
 * may go up as it likes. Tetra's stage uses it while her entrance plays for the first time, so a
 * visitor who keeps scrolling does not carry the page past her before she has stood up, and nobody
 * is trapped: the way back up is free, Escape lets go, and so does Tab (a focus that moves down the
 * page must be able to take the page with it).
 *
 * The site's own lock (`seams/scroll-lock.ts`) stops the smooth scroller, which holds both
 * directions. This one leaves the scroller running and takes only the input that would move the
 * page down: the wheel, a finger dragging up once the page is at the line, and the keys that go
 * down. A scroll that still gets past the line (a fling already under way, a scroll nobody
 * announced) is put back on it.
 */
interface HoldParts {
  /** The line: the scroll position the page may not pass, read each time it is needed. */
  line: () => number;
  getLenis: () => Lenis | null;
  /** The visitor asked out (Escape) or moved the focus (Tab). The owner of the hold releases it. */
  onLetGo: () => void;
}

/** The keys that move a page down. */
const DOWN_KEYS = new Set([" ", "Spacebar", "PageDown", "ArrowDown", "End"]);

/** How far past the line the page may be before it is put back, in pixels. */
const SLACK = 1;

/** Put the page on a position at once, through the smooth scroller when there is one. */
export function jumpTo(getLenis: () => Lenis | null, y: number): void {
  const lenis = getLenis();
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
  else window.scrollTo(0, y);
}

/** Start the hold. Returns the way to end it; calling that twice is safe. */
export function holdDown({ line, getLenis, onLetGo }: HoldParts): () => void {
  let touchY = 0;

  const onWheel = (e: WheelEvent) => {
    if (e.deltaY <= 0) return;
    const lenis = getLenis();
    const at = line();
    // Without the smooth scroller the browser moves the page and `onScroll` minds the line.
    if (!lenis && window.scrollY < at - 2) return;
    // Taken before the smooth scroller sees it, so it keeps no target past the line to glide to
    // afterwards. A page that was scrolled back up may still come down again, as far as the line.
    if (e.cancelable) e.preventDefault();
    e.stopImmediatePropagation();
    if (!lenis || window.scrollY >= at - 2) return;
    const step = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
    const from = Math.max(window.scrollY, Math.min(at, lenis.targetScroll));
    lenis.scrollTo(Math.min(at, from + step), { lerp: 0.12, force: true });
  };
  const onTouchStart = (e: TouchEvent) => {
    touchY = e.touches[0]?.clientY ?? 0;
  };
  const onTouchMove = (e: TouchEvent) => {
    const y = e.touches[0]?.clientY ?? touchY;
    // A finger moving up moves the page down. Short of the line the page still follows it.
    if (touchY - y <= 0 || window.scrollY < line() - 2) return;
    if (e.cancelable) e.preventDefault();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" || e.key === "Tab") {
      onLetGo();
      return;
    }
    if (!DOWN_KEYS.has(e.key) || !isScrollKey(e)) return;
    // Shift and Space goes up. Space on a button or a link presses it: that is left alone.
    if ((e.key === " " || e.key === "Spacebar") && e.shiftKey) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest("button, a[href], summary, [role='button']")) return;
    if (e.cancelable) e.preventDefault();
  };
  const onScroll = () => {
    const at = line();
    if (window.scrollY > at + SLACK) jumpTo(getLenis, at);
  };

  const active = { passive: false, capture: true } as const;
  window.addEventListener("wheel", onWheel, active);
  window.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
  window.addEventListener("touchmove", onTouchMove, active);
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("scroll", onScroll, { passive: true });

  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    window.removeEventListener("wheel", onWheel, active);
    window.removeEventListener("touchstart", onTouchStart, { capture: true });
    window.removeEventListener("touchmove", onTouchMove, active);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("scroll", onScroll);
  };
}
