/**
 * Holds the page still while the viewer is open, without pausing the smooth scroll (pausing it adds
 * `overflow: clip` to `<html>`, which hides the scrollbar and moves the page sideways). The wheel,
 * the touch and the scroll keys are stopped before the page sees them, except over the viewer's own
 * scroller (a tall strip read by scrolling), which scrolls the way a browser scrolls. The same
 * listeners take Escape and the side arrows, so a room's own key handlers never see them.
 */
import { isTypingTarget } from "@/lib/hooks";

export interface GuardOptions {
  /** The element that scrolls inside the viewer, or null when the picture is fitted. */
  scroller: () => HTMLElement | null;
  onEscape: () => void;
  onStep: (delta: 1 | -1) => void;
}

const SCROLL_KEYS = new Set([" ", "PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"]);

/** Whether `target` is inside a scroller that can scroll. */
function scrolls(scroller: HTMLElement | null, target: EventTarget | null): boolean {
  return (
    !!scroller &&
    target instanceof Node &&
    scroller.contains(target) &&
    scroller.scrollHeight > scroller.clientHeight + 1
  );
}

/** Start holding. Returns the function that lets go (it can be called more than once). */
export function installGuard(options: GuardOptions): () => void {
  const wheel = (e: WheelEvent) => {
    // The page's own handlers (and the smooth scroll) never see a wheel turn while the viewer is open.
    e.stopPropagation();
    if (e.ctrlKey) return;
    if (scrolls(options.scroller(), e.target)) return;
    if (e.cancelable) e.preventDefault();
  };

  const touch = (e: TouchEvent) => {
    if (scrolls(options.scroller(), e.target)) return;
    if (e.cancelable) e.preventDefault();
  };

  const key = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      options.onEscape();
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) options.onStep(e.key === "ArrowRight" ? 1 : -1);
      return;
    }
    if (!SCROLL_KEYS.has(e.key)) return;
    const target = e.target instanceof Element ? e.target : null;
    // A button or a link keeps Space. Over the strip the keys scroll it.
    if (e.key === " " && target?.closest("button, a, input, textarea, select")) return;
    if (scrolls(options.scroller(), e.target)) return;
    // The room's own key handlers (a section that moves on Arrow Down) never see it either.
    e.preventDefault();
    e.stopPropagation();
  };

  const opts = { capture: true, passive: false } as const;
  window.addEventListener("wheel", wheel, opts);
  window.addEventListener("touchmove", touch, opts);
  window.addEventListener("keydown", key, { capture: true });
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    window.removeEventListener("wheel", wheel, opts);
    window.removeEventListener("touchmove", touch, opts);
    window.removeEventListener("keydown", key, { capture: true });
  };
}
