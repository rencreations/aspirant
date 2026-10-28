"use client";

import { Dialog } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { ImageViewer, type ViewerImage } from "@/components/image-viewer/image-viewer";
import { useLenis } from "@/components/smooth-scroll";
import { asset } from "@/lib/asset";
import { clamp } from "@/lib/math";

import { comicPage } from "../media";
import { COMIC_COUNT, COMIC_SLOTS, COMIC_W } from "../shared/info";
import styles from "./comic-reader.module.css";

const KEY = "vexana:comic";

type Mode = "strip" | "pages";

interface Saved {
  page: number;
  mode: Mode;
}

function readSaved(): Saved {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Saved>;
      const known = COMIC_SLOTS.some((s) => s.n === v.page && s.tall !== null);
      return {
        page: known && typeof v.page === "number" ? v.page : 1,
        mode: v.mode === "pages" ? "pages" : "strip",
      };
    }
  } catch {
    // Not remembered: the reader starts on page 1.
  }
  return { page: 1, mode: "strip" };
}

function writeSaved(s: Saved) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Not saved: it lasts until the reader closes.
  }
}

const VIEWER_ITEMS: readonly ViewerImage[] = COMIC_SLOTS.flatMap((s) =>
  s.tall === null
    ? []
    : [
        {
          src: comicPage(s.n),
          thumb: comicPage(s.n),
          alt: `Comic page ${s.n}`,
          width: COMIC_W,
          height: Math.round(COMIC_W * s.tall),
          title: `Page ${s.n}`,
          set: "comic",
          setLabel: "Guinevere and Vexana, the comic",
          credit: { name: "The Aspirants", platform: "Comic" },
        },
      ],
);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The web comic reader. A page is an original page number: 3, 23 and 40 were never supplied, so the
 * reader keeps their places and shows a quiet card there, and the numbers always match the source.
 * Two ways to read: one long strip, or one page at a time. The last page and the way are remembered.
 */
function ReaderBody() {
  const { pause, resume } = useLenis();
  // This body mounts when the reader opens, so the saved place is read once, here.
  const [saved] = useState(readSaved);
  const [mode, setMode] = useState<Mode>(saved.mode);
  const [page, setPage] = useState(saved.page);
  const [zoomAt, setZoomAt] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const restored = useRef(false);

  useEffect(() => {
    pause();
    return resume;
  }, [pause, resume]);

  useEffect(() => {
    writeSaved({ page, mode });
  }, [page, mode]);

  const tiles = useCallback(
    () => Array.from(scroller.current?.querySelectorAll<HTMLElement>("[data-page]") ?? []),
    [],
  );

  const goTo = useCallback(
    (n: number, smooth: boolean) => {
      const target = clamp(n, 1, COMIC_SLOTS.length);
      setPage(target);
      if (mode === "strip") {
        const el = tiles().find((t) => t.dataset.page === String(target));
        const box = scroller.current;
        if (el && box)
          box.scrollTo({ top: el.offsetTop - 64, behavior: smooth ? "smooth" : "auto" });
      } else {
        scroller.current?.scrollTo({ top: 0 });
      }
    },
    [mode, tiles],
  );

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    requestAnimationFrame(() => {
      const box = scroller.current;
      if (!box) return;
      const tile = box.querySelector<HTMLElement>(`[data-page="${page}"]`);
      box.scrollTop = next === "strip" && tile ? Math.max(0, tile.offsetTop - 64) : 0;
    });
  };

  // The scroller mounts a moment after the dialog opens: jump to the remembered page then.
  const attach = useCallback((el: HTMLDivElement | null) => {
    scroller.current = el;
    if (!el || restored.current) return;
    restored.current = true;
    const s = readSaved();
    if (s.mode === "strip") {
      const tile = el.querySelector<HTMLElement>(`[data-page="${s.page}"]`);
      if (tile) el.scrollTop = Math.max(0, tile.offsetTop - 64);
    }
  }, []);

  // Strip: the page under the top third of the screen is the current one. Progress is the scroll.
  const onScroll = useCallback(() => {
    const box = scroller.current;
    if (!box) return;
    const max = box.scrollHeight - box.clientHeight;
    const p = max > 0 ? clamp(box.scrollTop / max) : 0;
    if (bar.current) bar.current.style.transform = `scaleX(${p.toFixed(4)})`;
    if (mode !== "strip") return;
    const line = box.scrollTop + box.clientHeight * 0.33;
    let current = 1;
    for (const t of tiles()) {
      if (t.offsetTop <= line) current = Number(t.dataset.page);
      else break;
    }
    setPage((prev) => (prev === current ? prev : current));
  }, [mode, tiles]);

  // Pages: progress is how far through the pages.
  useEffect(() => {
    if (mode === "pages" && bar.current) {
      bar.current.style.transform = `scaleX(${(page / COMIC_SLOTS.length).toFixed(4)})`;
    }
  }, [mode, page]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      if (e.key === "ArrowDown" && mode === "strip") return;
      e.preventDefault();
      goTo(page + 1, true);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      if (e.key === "ArrowUp" && mode === "strip") return;
      e.preventDefault();
      goTo(page - 1, true);
    } else if (e.key === "Home") {
      e.preventDefault();
      goTo(1, true);
    } else if (e.key === "End") {
      e.preventDefault();
      goTo(COMIC_SLOTS.length, true);
    }
  };

  const shown = useMemo(
    () => (mode === "pages" ? COMIC_SLOTS.filter((s) => s.n === page) : COMIC_SLOTS),
    [mode, page],
  );
  const viewerIndex = VIEWER_ITEMS.findIndex((v) => v.title === `Page ${page}`);

  return (
    <div className={styles.body} onKeyDown={onKey}>
      <Dialog.Title className={styles.srOnly}>Guinevere and Vexana, the comic</Dialog.Title>
      <header className={styles.bar}>
        <div className={styles.name}>
          <span className={styles.nameSmall}>The comic</span>
          <span className={styles.count}>
            Page {page} <i>of {COMIC_SLOTS.length}</i>
          </span>
        </div>
        <div className={styles.tools}>
          <div className={styles.toggle} role="group" aria-label="How to read">
            <button
              type="button"
              data-on={mode === "strip"}
              aria-pressed={mode === "strip"}
              onClick={() => {
                switchMode("strip");
              }}
            >
              Scroll
            </button>
            <button
              type="button"
              data-on={mode === "pages"}
              aria-pressed={mode === "pages"}
              onClick={() => {
                switchMode("pages");
              }}
            >
              Pages
            </button>
          </div>
          <button
            type="button"
            className={styles.tool}
            disabled={viewerIndex < 0}
            onClick={() => {
              setZoomAt(viewerIndex);
            }}
          >
            Zoom
          </button>
          <Dialog.Close className={styles.tool}>Close</Dialog.Close>
        </div>
        <span className={styles.track} aria-hidden="true">
          <span ref={bar} className={styles.fill} />
        </span>
      </header>

      <div
        ref={attach}
        className={styles.scroller}
        data-mode={mode}
        data-lenis-prevent
        onScroll={onScroll}
        tabIndex={0}
      >
        <ol className={styles.strip}>
          {shown.map((s) =>
            s.tall === null ? (
              <li key={s.n} data-page={s.n} className={styles.gap}>
                <span>Page {s.n}</span>
                <small>never supplied</small>
              </li>
            ) : (
              <li
                key={s.n}
                data-page={s.n}
                className={styles.tile}
                style={{ aspectRatio: `1 / ${s.tall}` }}
              >
                {/* Plain <img>: static export. The box has the page's shape, so nothing jumps. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset(comicPage(s.n))}
                  alt={`Comic page ${s.n}`}
                  loading={s.n <= 2 ? "eager" : "lazy"}
                  decoding="async"
                  draggable={false}
                />
              </li>
            ),
          )}
        </ol>
        <p className={styles.end}>{COMIC_COUNT} pages. Pages 3, 23 and 40 were never supplied.</p>
      </div>

      {mode === "pages" ? (
        <div className={styles.pager}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              goTo(page - 1, true);
            }}
            aria-label="Previous page"
          >
            Back
          </button>
          <button
            type="button"
            disabled={page >= COMIC_SLOTS.length}
            onClick={() => {
              goTo(page + 1, true);
            }}
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      ) : null}

      <ImageViewer
        items={VIEWER_ITEMS}
        index={zoomAt}
        onIndexChange={setZoomAt}
        label="The comic"
        skin={{
          ground: "var(--vx-0e0a1a, #0e0a1a)",
          keyline: "var(--vx-b79cf2, #b79cf2)",
          accent: "var(--vx-e040a0, #e040a0)",
        }}
      />
    </div>
  );
}

export function ComicReader({ open, onOpenChange }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.reader} aria-describedby={undefined}>
          <ReaderBody />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
