/**
 * What the dive and the wipe share: finding the reader once the page has changed, holding the scroll
 * while a change runs, and the small waits.
 */
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { REVEAL_EVENT } from "@/lib/hooks";

export function pathOf(href: string): string {
  return (href.split(/[?#]/u)[0] ?? "/").replace(/\/+$/u, "") || "/";
}

function frames(n: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => {
      if (left <= 0) resolve();
      else requestAnimationFrame(() => step(left - 1));
    };
    step(n);
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Hold the scroll while a change runs (wheel, touch and the scrolling keys do nothing). Lenis is not
 * paused: that hides the scrollbar and moves the page sideways. The returned function lets go once
 * the momentum of the wheel that started the change has run out.
 */
export function holdScroll(): () => Promise<void> {
  const keys = new Set([" ", "PageUp", "PageDown", "ArrowUp", "ArrowDown", "Home", "End"]);
  let lastWheel = 0;
  const stop = (e: Event) => {
    if (e.type === "wheel") lastWheel = performance.now();
    if (e instanceof KeyboardEvent && !keys.has(e.key)) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  };
  const opts = { capture: true, passive: false } as const;
  window.addEventListener("wheel", stop, opts);
  window.addEventListener("touchmove", stop, opts);
  window.addEventListener("keydown", stop, opts);
  return async () => {
    const until = performance.now() + 1200;
    while (performance.now() - lastWheel < 150 && performance.now() < until) await frames(1);
    window.removeEventListener("wheel", stop, opts);
    window.removeEventListener("touchmove", stop, opts);
    window.removeEventListener("keydown", stop, opts);
  };
}

/**
 * Change the page and resolve when the address is the new one. No timer: the new page's own files
 * may be slow, and the change waits for them (if the router cannot fetch the page it loads the
 * address as a whole page, which starts over).
 */
export function useGoto(): (href: string) => Promise<void> {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const waiters = useRef(new Set<() => void>());
  useEffect(() => {
    pathRef.current = pathname;
    for (const look of Array.from(waiters.current)) look();
  }, [pathname]);
  return useCallback(
    (href: string) =>
      new Promise<void>((resolve) => {
        const target = pathOf(href);
        const look = () => {
          if (pathOf(pathRef.current) !== target) return;
          waiters.current.delete(look);
          resolve();
        };
        waiters.current.add(look);
        router.push(href as Route, { scroll: false });
        look();
      }),
    [router],
  );
}

/** What a new page needs after the change: back at the top, its reveals told, the focus on it. */
export function arrive(scrollTo: (top: number, options?: { immediate?: boolean }) => void): void {
  scrollTo(0, { immediate: true });
  window.scrollTo(0, 0);
  window.dispatchEvent(new Event(REVEAL_EVENT));
  document.getElementById("main")?.focus({ preventScroll: true });
}

/** The reader's first page as it stands: the box of the page and whether the comic is open at its very top. */
export interface ReaderFirst {
  /** The page, in the screen's pixels. Null when the reader is not open on the first page. */
  rect: DOMRect | null;
}

const READER_WAIT_MS = 20_000;

/**
 * Wait for the reader of a comic to be on screen with its first page drawn, and say where that page
 * stands. The reader is `position: fixed`, so what is measured is what the visitor sees. When it
 * opened on a saved place (not the top) there is nothing to settle into and the rect is null.
 */
export async function readerFirst(firstN: number): Promise<ReaderFirst> {
  const until = performance.now() + READER_WAIT_MS;
  let scroller: HTMLElement | null = null;
  while (performance.now() < until) {
    scroller = document.querySelector<HTMLElement>("[data-comic-scroller]");
    if (scroller?.querySelector("[data-n]")) break;
    scroller = null;
    await frames(1);
  }
  if (!scroller) throw new Error("the reader did not open");
  const page = scroller.querySelector<HTMLElement>("[data-n]");
  const pictures = Array.from(page?.querySelectorAll("img") ?? []);
  await Promise.all(pictures.map((img) => img.decode().catch(() => undefined)));
  await frames(2);
  const onFirst = page?.dataset.n === String(firstN) && scroller.scrollTop < 2;
  return { rect: onFirst && page ? page.getBoundingClientRect() : null };
}
