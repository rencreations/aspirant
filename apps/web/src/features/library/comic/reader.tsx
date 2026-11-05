"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { useLenis } from "@/components/smooth-scroll";
import { audio } from "@/lib/audio";
import { isTypingTarget } from "@/lib/hooks";
import { libUrl } from "@/lib/library";

import { CanonBadge } from "../shell/credit";
import styles from "./reader.module.css";
import { listNumbers, sequenceOf } from "./transcript";
import { TranscriptPanel } from "./transcript-panel";
import type { ComicItem, ComicPage } from "./types";
import { writeProgress } from "./progress";

const FIT_KEY = "aspirants:library:comic-fit";
/** The widest a page is drawn when it fits the width, in CSS pixels. */
const MAX_PAGE_W = 1080;

type Fit = "width" | "height";

function readFit(): Fit {
  try {
    return window.localStorage.getItem(FIT_KEY) === "height" ? "height" : "width";
  } catch {
    return "width";
  }
}

function writeFit(fit: Fit): void {
  try {
    window.localStorage.setItem(FIT_KEY, fit);
  } catch {
    /* storage may be blocked */
  }
}

interface ReaderProps {
  comic: ComicItem;
  prev: ComicItem | null;
  next: ComicItem | null;
  /** The page to open on, or null for the top. */
  startPage: number | null;
  onClose: () => void;
  onOpenComic: (id: string) => void;
  /** Tells the address which page is in view (called after the visitor stops scrolling). */
  onPage: (n: number) => void;
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d={d} stroke="currentColor" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

/** One page, drawn as one picture or as its slices, at its real shape so nothing jumps. */
function PageView({
  comic,
  page,
  shownWidth,
  eager,
}: {
  comic: ComicItem;
  page: ComicPage;
  shownWidth: number;
  eager: boolean;
}) {
  const hasPreview = page.p !== page.f;
  const previewW = Math.min(1000, page.w);
  const sizes = `${Math.max(1, Math.round(shownWidth))}px`;
  const alt = `${comic.title}, page ${page.n}`;
  const pieces = page.s ?? [{ f: page.f, p: page.p, h: page.h, ph: 0 }];
  const sliced = page.s !== undefined;
  const tops = pieces.map((_, i) => pieces.slice(0, i).reduce((sum, s) => sum + s.h, 0));

  return (
    <div
      className={styles.page}
      data-n={page.n}
      style={
        {
          "--ar": page.w / page.h,
          "--maxw": `${Math.min(MAX_PAGE_W, page.w)}px`,
          aspectRatio: `${page.w} / ${page.h}`,
          background: page.c,
        } as CSSProperties
      }
    >
      {pieces.map((s, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={s.f}
          className={styles.piece}
          src={libUrl(hasPreview ? s.p : s.f)}
          srcSet={hasPreview ? `${libUrl(s.p)} ${previewW}w, ${libUrl(s.f)} ${page.w}w` : undefined}
          sizes={hasPreview ? sizes : undefined}
          width={page.w}
          height={s.h}
          // A slice sits at its place in the page and overlaps the next one by a pixel, so a
          // fractional scale never leaves a hairline between two slices.
          style={
            sliced
              ? {
                  top: `${(tops[i]! / page.h) * 100}%`,
                  height: `calc(${(s.h / page.h) * 100}% + 1px)`,
                }
              : { aspectRatio: `${page.w} / ${s.h}` }
          }
          data-sliced={sliced ? "true" : undefined}
          alt={i === 0 ? alt : ""}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
        />
      ))}
      <a
        className={`${styles.chip} hud-label`}
        href={libUrl(page.f)}
        target="_blank"
        rel="noopener noreferrer"
        download={`${comic.id.replace(/^comic-/, "")}-page-${page.n}.webp`}
        aria-label={`Open the full size file of page ${page.n}`}
      >
        <span>{page.n}</span>
        <span className={styles.chipText}>Full size</span>
      </a>
    </div>
  );
}

/**
 * The reader: one scroll of pages in a layer over the room, the text of the page in view beside
 * it (a drawer on a phone), a progress bar, keys, and a notice where the source lacks a page.
 */
export function Reader({
  comic,
  prev,
  next,
  startPage,
  onClose,
  onOpenComic,
  onPage,
}: ReaderProps) {
  const sequence = useMemo(() => sequenceOf(comic), [comic]);
  const hasText = (comic.transcript?.length ?? 0) > 0;
  const firstN = sequence[0]?.n ?? 1;
  // Where the reader opens. It is decided once: the address follows the reading afterwards.
  const [initial] = useState(() =>
    startPage !== null && sequence.some((e) => e.n === startPage) ? startPage : firstN,
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const currentRef = useRef(initial);
  const textOpenRef = useRef(false);

  const [current, setCurrent] = useState(initial);
  const [fit, setFit] = useState<Fit>(readFit);
  // The text column is open from the start where there is room for it.
  const [textOpen, setTextOpen] = useState(
    () => hasText && window.matchMedia("(min-width: 70em)").matches,
  );
  const [colW, setColW] = useState(MAX_PAGE_W);
  const [availH, setAvailH] = useState(800);
  const { pause, resume } = useLenis();

  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(() => {
    textOpenRef.current = textOpen;
  }, [textOpen]);

  // The page behind the reader stops scrolling while it is open.
  useEffect(() => {
    pause();
    return resume;
  }, [pause, resume]);

  const scrollToN = useCallback((n: number, smooth: boolean) => {
    const scroller = scrollerRef.current;
    const strip = stripRef.current;
    if (!scroller || !strip) return;
    const el = strip.querySelector<HTMLElement>(`[data-n="${n}"]`);
    if (!el) return;
    const top =
      scroller.scrollTop +
      el.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top -
      8;
    scroller.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Open on the saved page, before the first paint.
  useLayoutEffect(() => {
    scrollToN(initial, false);
    scrollerRef.current?.focus({ preventScroll: true });
  }, [initial, scrollToN]);

  // The progress bar is a transform written straight to the element, and the page in view is the
  // last one whose top has passed a line a little below the top of the strip.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const strip = stripRef.current;
    const fill = fillRef.current;
    if (!scroller || !strip || !fill) return;
    let raf = 0;
    const paint = () => {
      raf = 0;
      const max = scroller.scrollHeight - scroller.clientHeight;
      fill.style.transform = `scaleX(${max > 0 ? Math.min(1, scroller.scrollTop / max) : 0})`;
      const els = strip.children;
      const line = scroller.getBoundingClientRect().top + 100;
      let lo = 0;
      let hi = els.length - 1;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if ((els[mid] as HTMLElement).getBoundingClientRect().top <= line) lo = mid;
        else hi = mid - 1;
      }
      const n = Number((els[lo] as HTMLElement | undefined)?.dataset.n);
      if (Number.isFinite(n)) setCurrent(n);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    paint();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Remember the place and tell the address, a moment after the visitor stops.
  useEffect(() => {
    const t = window.setTimeout(() => {
      writeProgress(comic.id, current);
      onPage(current);
    }, 450);
    return () => {
      window.clearTimeout(t);
    };
  }, [comic.id, current, onPage]);

  // The width of the column and the height of the screen decide how big a page is drawn.
  useEffect(() => {
    const strip = stripRef.current;
    const root = rootRef.current;
    if (!strip || !root) return;
    const measure = () => {
      setColW(Math.round(strip.clientWidth / 8) * 8);
      const barH = barRef.current?.offsetHeight ?? 56;
      root.style.setProperty("--bar-h", `${barH}px`);
      setAvailH(Math.max(240, root.clientHeight - barH - 16));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(strip);
    ro.observe(root);
    return () => {
      ro.disconnect();
    };
  }, [textOpen]);

  // A change of size moves every page: hold the one in view.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      scrollToN(currentRef.current, false);
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, [fit, textOpen, scrollToN]);

  const index = Math.max(
    0,
    sequence.findIndex((e) => e.n === current),
  );
  const step = useCallback(
    (dir: 1 | -1) => {
      const target = sequence[Math.min(sequence.length - 1, Math.max(0, index + dir))];
      if (target) scrollToN(target.n, true);
    },
    [sequence, index, scrollToN],
  );

  const changeFit = (next: Fit) => {
    audio.blip("click");
    setFit(next);
    writeFit(next);
  };

  // Keys. Space and the arrows scroll the strip wherever the focus is; the rest is listed in the notice.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const target = e.target as HTMLElement | null;
      const inScroller = target === scroller;
      const onControl = !!target?.closest("button, a, summary");
      const scrollBy = (dy: number) => {
        e.preventDefault();
        scroller.focus({ preventScroll: true });
        scroller.scrollBy({ top: dy, behavior: "smooth" });
      };
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          if (textOpenRef.current && window.matchMedia("(max-width: 70em)").matches) {
            setTextOpen(false);
          } else {
            onClose();
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          step(1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          step(-1);
          break;
        case "Home":
          e.preventDefault();
          scroller.scrollTo({ top: 0, behavior: "smooth" });
          break;
        case "End":
          e.preventDefault();
          scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
          break;
        case "t":
        case "T":
          if (hasText) setTextOpen((v) => !v);
          break;
        case "f":
        case "F":
          changeFit(fit === "width" ? "height" : "width");
          break;
        case "[":
          if (prev) onOpenComic(prev.id);
          break;
        case "]":
          if (next) onOpenComic(next.id);
          break;
        case " ":
          if (!inScroller && !onControl)
            scrollBy((e.shiftKey ? -1 : 1) * scroller.clientHeight * 0.85);
          break;
        case "PageDown":
          if (!inScroller) scrollBy(scroller.clientHeight * 0.9);
          break;
        case "PageUp":
          if (!inScroller) scrollBy(-scroller.clientHeight * 0.9);
          break;
        case "ArrowDown":
          if (!inScroller) scrollBy(120);
          break;
        case "ArrowUp":
          if (!inScroller) scrollBy(-120);
          break;
        default:
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [fit, hasText, next, onClose, onOpenComic, prev, step]);

  const currentPage = comic.pages.find((p) => p.n === current);
  const startIndex = sequence.findIndex((e) => e.n === initial);

  return (
    <div
      ref={rootRef}
      className={styles.reader}
      data-theme="storm"
      data-fit={fit}
      data-text={hasText && textOpen ? "open" : "closed"}
      role="dialog"
      aria-modal="true"
      aria-label={`Reading ${comic.title}`}
    >
      <div ref={barRef} className={styles.bar}>
        <div className={styles.barMain}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              audio.blip("click");
              onClose();
            }}
            aria-label="Back to the shelf"
            title="Back to the shelf (Esc)"
          >
            <Icon d="M10 2L4 8l6 6" />
            <span className={styles.btnText}>Shelf</span>
          </button>
          <div className={styles.titleBox}>
            <p className={`${styles.kicker} hud-label`}>
              <span>
                Page <strong>{current}</strong> of {comic.total}
              </span>
              {comic.canon !== "official" ? <CanonBadge canon={comic.canon} /> : null}
            </p>
            <h2 className={`${styles.title} display`}>{comic.title}</h2>
          </div>
          <label className={styles.jump}>
            <span className="hud-label">Go to</span>
            <select
              value={current}
              onChange={(e) => {
                scrollToN(Number(e.target.value), false);
              }}
            >
              {sequence.map((e) => (
                <option key={e.n} value={e.n}>
                  {e.kind === "missing" ? `Page ${e.n} (missing)` : `Page ${e.n}`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.tools}>
          <div className={styles.group} role="group" aria-label="Page size">
            <button
              type="button"
              className={styles.seg}
              aria-pressed={fit === "width"}
              onClick={() => {
                changeFit("width");
              }}
              title="Page fills the width (F)"
            >
              Fit width
            </button>
            <button
              type="button"
              className={styles.seg}
              aria-pressed={fit === "height"}
              onClick={() => {
                changeFit("height");
              }}
              title="Whole page in one screen (F)"
            >
              Fit height
            </button>
          </div>
          {hasText ? (
            <button
              type="button"
              className={styles.btn}
              aria-pressed={textOpen}
              onClick={() => {
                audio.blip("click");
                setTextOpen((v) => !v);
              }}
              title="Show the text of the page (T)"
            >
              Text
            </button>
          ) : null}
          <div className={styles.group} role="group" aria-label="Page">
            <button
              type="button"
              className={styles.seg}
              onClick={() => {
                step(-1);
              }}
              disabled={index === 0}
              aria-label="Previous page"
              title="Previous page (left arrow)"
            >
              <Icon d="M10 2L4 8l6 6" />
            </button>
            <button
              type="button"
              className={styles.seg}
              onClick={() => {
                step(1);
              }}
              disabled={index >= sequence.length - 1}
              aria-label="Next page"
              title="Next page (right arrow)"
            >
              <Icon d="M6 2l6 6-6 6" />
            </button>
          </div>
          <div className={styles.group} role="group" aria-label="Comic">
            <button
              type="button"
              className={styles.seg}
              disabled={!prev}
              onClick={() => {
                if (prev) onOpenComic(prev.id);
              }}
              aria-label={prev ? `Previous comic, ${prev.title}` : "No previous comic"}
              title={prev ? `Previous comic: ${prev.title} ([)` : undefined}
            >
              <Icon d="M13 2L7 8l6 6M5 2v12" />
            </button>
            <button
              type="button"
              className={styles.seg}
              disabled={!next}
              onClick={() => {
                if (next) onOpenComic(next.id);
              }}
              aria-label={next ? `Next comic, ${next.title}` : "No next comic"}
              title={next ? `Next comic: ${next.title} (])` : undefined}
            >
              <Icon d="M3 2l6 6-6 6M11 2v12" />
            </button>
          </div>
          {currentPage ? (
            <a
              className={`${styles.btn} ${styles.full}`}
              href={libUrl(currentPage.f)}
              target="_blank"
              rel="noopener noreferrer"
              download
              title="Opens the full size file of this page. Save it from there."
            >
              Full size
            </a>
          ) : null}
        </div>
        <span className={styles.progress} aria-hidden="true">
          <span ref={fillRef} className={styles.fill} />
        </span>
      </div>

      <div className={styles.main}>
        <div
          ref={scrollerRef}
          className={styles.scroller}
          tabIndex={0}
          role="region"
          aria-label={`${comic.title}, pages`}
          data-lenis-prevent
        >
          {comic.missing.length > 0 ? (
            <p className={styles.notice}>
              Pages {listNumbers(comic.missing)} are missing in the source. The numbers of the
              original are kept.
            </p>
          ) : null}
          <div ref={stripRef} className={styles.strip}>
            {sequence.map((e, i) =>
              e.kind === "page" ? (
                <PageView
                  key={e.n}
                  comic={comic}
                  page={e.page}
                  eager={Math.abs(i - startIndex) <= 1}
                  shownWidth={
                    fit === "width"
                      ? Math.min(colW, MAX_PAGE_W, e.page.w)
                      : Math.min(colW, MAX_PAGE_W, e.page.w, (availH * e.page.w) / e.page.h)
                  }
                />
              ) : (
                <div key={e.n} className={styles.missing} data-n={e.n}>
                  <p className="hud-label">Page {e.n}</p>
                  <p>This page is missing in the source.</p>
                </div>
              ),
            )}
          </div>
          <div className={styles.end}>
            <p className="hud-label">End of {comic.title}</p>
            <div className={styles.endRow}>
              {next ? (
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => {
                    audio.blip("click");
                    onOpenComic(next.id);
                  }}
                >
                  Next: {next.title}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  audio.blip("click");
                  onClose();
                }}
              >
                Back to the shelf
              </button>
            </div>
          </div>
        </div>

        {hasText ? (
          <TranscriptPanel
            comic={comic}
            current={current}
            open={textOpen}
            onClose={() => {
              setTextOpen(false);
            }}
            onJump={(n) => {
              scrollToN(n, true);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
