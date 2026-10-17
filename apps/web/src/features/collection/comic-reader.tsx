"use client";

import { Dialog } from "radix-ui";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { prefersReducedMotion } from "@/lib/hooks";

import { readComicPage, writeComicPage } from "./comic-progress";
import styles from "./dialogs.module.css";
import { listPages } from "./format";
import { restoreFocusTo, shieldNextHotkey, useModalScrollLock } from "./modal-utils";
import type { ComicItem } from "./types";

interface ComicReaderProps {
  comic: ComicItem | null;
  opener: HTMLElement | null;
  onClose: () => void;
}

/**
 * Vertical comic reader for the webtoon strips: one continuous scroll in a dialog. Pages are
 * lazy images with their real width and height, so the layout never jumps. Space, Page Down
 * and the arrow keys scroll (the strip has focus), the slider and the page box jump, and the
 * last page you reached is remembered in this browser.
 */
export default function ComicReader({ comic, opener, onClose }: ComicReaderProps) {
  const open = comic !== null;
  useModalScrollLock(open);

  return (
    <Dialog.Root open={open} onOpenChange={(value) => !value && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} data-theme="storm" />
        {comic && <ReaderBody key={comic.id} comic={comic} opener={opener} />}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ReaderBody({ comic, opener }: { comic: ComicItem; opener: HTMLElement | null }) {
  const pages = comic.pages;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const offsets = useRef<number[]>([]);
  const restored = useRef(false);
  const saveTimer = useRef(0);
  const [current, setCurrent] = useState(0);
  const [jump, setJump] = useState("1");

  const measure = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    offsets.current = Array.from(strip.children).map((child) => (child as HTMLElement).offsetTop);
  }, []);

  const indexAt = useCallback((scrollTop: number, viewport: number) => {
    const line = scrollTop + viewport * 0.35;
    const list = offsets.current;
    let lo = 0;
    let hi = list.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if ((list[mid] ?? 0) <= line) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }, []);

  const jumpTo = useCallback(
    (index: number, smooth = true) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const i = Math.min(Math.max(0, index), pages.length - 1);
      scroller.scrollTo({
        top: offsets.current[i] ?? 0,
        behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
      });
    },
    [pages.length],
  );

  // Measure, then restore the saved position.
  useEffect(() => {
    measure();
    const strip = stripRef.current;
    const ro = strip ? new ResizeObserver(measure) : null;
    if (strip) for (const child of Array.from(strip.children)) ro?.observe(child);
    const saved = readComicPage(comic.comicId);
    const startIndex = saved
      ? Math.max(
          0,
          pages.findIndex((p) => p.page >= saved),
        )
      : 0;
    const raf = requestAnimationFrame(() => {
      measure();
      if (startIndex > 0) jumpTo(startIndex, false);
      setCurrent(startIndex);
      setJump(String(pages[startIndex]?.page ?? 1));
      restored.current = true;
    });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.clearTimeout(saveTimer.current);
    };
  }, [comic.comicId, pages, measure, jumpTo]);

  const onScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || !restored.current) return;
    const index = indexAt(scroller.scrollTop, scroller.clientHeight);
    setCurrent((prev) => {
      if (prev === index) return prev;
      return index;
    });
    const page = pages[index]?.page;
    if (page === undefined) return;
    setJump(String(page));
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => writeComicPage(comic.comicId, page), 250);
  };

  const goToTypedPage = () => {
    const n = Number(jump);
    if (!Number.isFinite(n)) return;
    const target = pages.findIndex((p) => p.page >= n);
    jumpTo(target === -1 ? pages.length - 1 : target);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    shieldNextHotkey(e);
  };

  const pageNumber = pages[current]?.page ?? 1;
  const lastPage = pages[pages.length - 1]?.page ?? pages.length;
  const fill = pages.length > 1 ? (current / (pages.length - 1)) * 100 : 100;

  return (
    <Dialog.Content
      className={`${styles.content} ${styles.reader}`}
      data-theme="storm"
      onKeyDown={onKeyDown}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        scrollerRef.current?.focus({ preventScroll: true });
      }}
      onCloseAutoFocus={restoreFocusTo(opener)}
    >
      <Dialog.Description className="sr-only">
        Comic reader. The comic scrolls top to bottom. Use Space, Page Down or the arrow keys to
        scroll, the slider or the page box to jump, and Escape to go back to the collection.
      </Dialog.Description>
      <div className={styles.readerHead}>
        <div className={styles.head}>
          <div className={styles.headText}>
            <p className={styles.kicker}>
              Page <strong>{pageNumber}</strong> of {lastPage}
              {comic.missingPages.length > 0
                ? ` / Pages ${listPages(comic.missingPages)} are missing from the source`
                : ""}
            </p>
            <Dialog.Title className={styles.title}>{comic.title}</Dialog.Title>
          </div>
          <div className={styles.tools}>
            <label className={styles.jump}>
              <span>Page</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                value={jump}
                onChange={(e) => setJump(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    goToTypedPage();
                  }
                }}
                onBlur={goToTypedPage}
              />
            </label>
            <Dialog.Close className={styles.btn} onClick={() => audio.blip("click")}>
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M10 2L4 8l6 6" stroke="currentColor" strokeWidth="1.6" fill="none" />
              </svg>
              Back to collection
            </Dialog.Close>
          </div>
        </div>
        <input
          type="range"
          className={styles.progress}
          aria-label="Reading progress. Move to jump to a page."
          min={1}
          max={Math.max(2, pages.length)}
          step={1}
          value={current + 1}
          aria-valuetext={`Page ${pageNumber} of ${lastPage}`}
          style={{ "--fill": `${fill}%` } as CSSProperties}
          onChange={(e) => jumpTo(Number(e.target.value) - 1, false)}
        />
      </div>

      <div
        ref={scrollerRef}
        className={styles.scroller}
        tabIndex={0}
        role="region"
        aria-label={`${comic.title}, comic pages`}
        data-lenis-prevent
        onScroll={onScroll}
      >
        <div ref={stripRef} className={styles.strip}>
          {pages.map((page, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={page.file}
              className={styles.page}
              src={asset(page.file)}
              alt={`${comic.title}, page ${page.page}`}
              width={page.width}
              height={page.height}
              loading={i < 2 ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
            />
          ))}
        </div>
        <p className={styles.pageNote}>End of {comic.title}.</p>
      </div>
    </Dialog.Content>
  );
}
