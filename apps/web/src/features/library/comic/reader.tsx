"use client";

import { Popover } from "radix-ui";
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
import { TLink } from "@/components/transition/t-link";
import { ReportLink } from "@/features/legal/takedown/report-link";
import { audio } from "@/lib/audio";
import { isTypingTarget } from "@/lib/hooks";
import { libUrl } from "@/lib/library";
import { useNavLock } from "@/lib/nav-lock";
import { collectionRoute } from "@/lib/site";

import { CanonBadge } from "../shell/credit";
import { writeProgress } from "./progress";
import styles from "./reader.module.css";
import { comicPath } from "./route";
import { listNumbers, sequenceOf } from "./transcript";
import { TranscriptPanel } from "./transcript-panel";
import type { ComicItem, ComicPage } from "./types";

/** The widest a page is drawn at the width of the column, in CSS pixels. */
const MAX_PAGE_W = 1080;
/** Zoom steps. Pages always fit the width at 100 percent; there is no other fit. */
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 2.4;
const ZOOM_STEP = 0.2;
/** The reader is "at the very top" until the strip has moved this far (it comes back at the lower one). */
const AWAY_PX = 16;
const BACK_PX = 4;

interface ReaderProps {
  comic: ComicItem;
  prev: ComicItem | null;
  next: ComicItem | null;
  /** The page to open on, or null for the top. */
  startPage: number | null;
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

/** The comic before or after this one: its cover and its name, a link to its page. */
function Neighbour({ comic, dir }: { comic: ComicItem; dir: "prev" | "next" }) {
  return (
    <TLink
      href={comicPath(comic.slug) as never}
      transitionLabel={comic.title}
      className={styles.neighbour}
      data-dir={dir}
      aria-label={`${dir === "prev" ? "Previous" : "Next"} comic, ${comic.title}`}
    >
      <span className={styles.thumb} style={{ background: comic.cover.c }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={libUrl(comic.cover.t)}
          width={comic.cover.w}
          height={comic.cover.h}
          alt=""
          loading="lazy"
          decoding="async"
        />
      </span>
      <span className={styles.neighbourText}>
        <span className="hud-label">{dir === "prev" ? "Previous comic" : "Next comic"}</span>
        <span className={`${styles.neighbourTitle} display`}>{comic.title}</span>
      </span>
    </TLink>
  );
}

/**
 * The reader of one comic, a page of its own. One scroll of pages, the text of the page in view
 * beside it (a drawer on a phone), a progress bar, and a notice where the source lacks a page.
 *
 * The reading is meant to be immersive. At the very top of the comic the top bar and a control bar
 * (the title, the page and the text) are shown, and the page is not covered by them. The moment the
 * visitor scrolls, both fold into one small button at the top left and fade; the button opens a
 * list with the same things (the way back, the title, the page to go to, the text). Back at the
 * very top they unfold again. At the end of the comic are the comics before and after it, and a
 * zoom, for the pages, stays in a corner.
 */
export function Reader({ comic, prev, next, startPage }: ReaderProps) {
  const sequence = useMemo(() => sequenceOf(comic), [comic]);
  const hasText = (comic.transcript?.length ?? 0) > 0;
  const firstN = sequence[0]?.n ?? 1;
  const lastN = sequence[sequence.length - 1]?.n ?? firstN;
  // Where the reader opens. It is decided once: the address follows the reading afterwards.
  const [initial] = useState(() =>
    startPage !== null && sequence.some((e) => e.n === startPage) ? startPage : firstN,
  );

  const scrollerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const currentRef = useRef(initial);

  const [current, setCurrent] = useState(initial);
  const [away, setAway] = useState(initial !== firstN);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  // The text is off until the visitor asks for it.
  const [textOpen, setTextOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [colW, setColW] = useState(MAX_PAGE_W);
  const { pause, resume } = useLenis();

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  // The page behind stops scrolling while the reader is open.
  useEffect(() => {
    pause();
    return resume;
  }, [pause, resume]);

  // The top bar: dark like the reader, and folded away together with the control bar.
  useEffect(() => {
    useNavLock.setState({ theme: "storm", bare: false, fade: true, away });
  }, [away]);
  useEffect(
    () => () => {
      useNavLock.setState({ theme: null, bare: false, fade: false, away: false });
    },
    [],
  );

  const scrollToN = useCallback(
    (n: number, smooth: boolean) => {
      const scroller = scrollerRef.current;
      const strip = stripRef.current;
      if (!scroller || !strip) return;
      // The first page is the very top of the comic, where the bars are.
      if (n === firstN) {
        scroller.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
        return;
      }
      const el = strip.querySelector<HTMLElement>(`[data-n="${n}"]`);
      if (!el) return;
      const top =
        scroller.scrollTop +
        el.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top -
        8;
      scroller.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
    },
    [firstN],
  );

  // Open on the saved page, before the first paint.
  useLayoutEffect(() => {
    scrollToN(initial, false);
    scrollerRef.current?.focus({ preventScroll: true });
  }, [initial, scrollToN]);

  // The progress bar is a transform written straight to the element, the page in view is the last
  // one whose top has passed a line a little below the top of the strip, and the bars are away as
  // soon as the strip has left the very top.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const strip = stripRef.current;
    const fill = fillRef.current;
    if (!scroller || !strip || !fill) return;
    let raf = 0;
    const paint = () => {
      raf = 0;
      const top = scroller.scrollTop;
      const max = scroller.scrollHeight - scroller.clientHeight;
      fill.style.transform = `scaleX(${max > 0 ? Math.min(1, top / max) : 0})`;
      setAway((was) => (top > AWAY_PX ? true : top <= BACK_PX ? false : was));
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
      const url = new URL(window.location.href);
      url.searchParams.set("p", String(current));
      window.history.replaceState(window.history.state, "", url);
    }, 450);
    return () => {
      window.clearTimeout(t);
    };
  }, [comic.id, current]);

  // The width of the column decides how big a page is drawn; the height of the bars is the room
  // kept clear above the first page.
  useEffect(() => {
    const strip = stripRef.current;
    const root = scrollerRef.current?.parentElement;
    if (!strip || !root) return;
    const measure = () => {
      setColW(Math.round(strip.clientWidth / 8) * 8);
      const barH = barRef.current?.offsetHeight ?? 64;
      root.style.setProperty("--bar-h", `${barH}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(strip);
    if (barRef.current) ro.observe(barRef.current);
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
  }, [zoom, textOpen, scrollToN]);

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

  const changeZoom = useCallback((dir: 1 | -1) => {
    audio.blip("click");
    setZoom((z) => {
      const next = Math.round((z + dir * ZOOM_STEP) * 100) / 100;
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    });
  }, []);

  /** Go to the page that was typed: the nearest one the comic has. */
  const jump = (raw: string) => {
    const wanted = Number(raw);
    if (!Number.isFinite(wanted) || raw === "") return;
    let best = firstN;
    for (const e of sequence) if (Math.abs(e.n - wanted) < Math.abs(best - wanted)) best = e.n;
    setDraft(null);
    setMenuOpen(false);
    scrollToN(Math.min(lastN, Math.max(firstN, best)), false);
  };

  // Keys. Space and the arrows scroll the strip wherever the focus is.
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
          if (textOpen && window.matchMedia("(max-width: 70em)").matches) {
            e.preventDefault();
            setTextOpen(false);
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
        case "+":
        case "=":
          changeZoom(1);
          break;
        case "-":
          changeZoom(-1);
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
  }, [changeZoom, hasText, step, textOpen]);

  const startIndex = sequence.findIndex((e) => e.n === initial);
  const fan = comic.canon !== "official";
  const backHref = collectionRoute("comic");

  const textSwitch = hasText ? (
    <button
      type="button"
      role="switch"
      aria-checked={textOpen}
      className={styles.switch}
      onClick={() => {
        audio.blip("click");
        setTextOpen((v) => !v);
      }}
      title="Show the text of the page (T)"
    >
      <span>Text</span>
      <span className={styles.knob} aria-hidden="true" />
    </button>
  ) : null;

  return (
    <main
      className={styles.reader}
      data-theme="storm"
      data-text={hasText && textOpen ? "open" : "closed"}
      data-away={away ? "true" : undefined}
      aria-label={`Reading ${comic.title}`}
    >
      <h1 className="sr-only">{comic.title}</h1>

      {/* The control bar: only at the very top. It folds into the button below. */}
      <div
        ref={barRef}
        className={styles.bar}
        data-away={away ? "true" : undefined}
        inert={away}
        data-comic-bar=""
      >
        <TLink
          href={backHref}
          transitionLabel="Comics"
          className={styles.btn}
          aria-label="Back to the shelf"
        >
          <Icon d="M10 2L4 8l6 6" />
          <span className={styles.btnText}>Shelf</span>
        </TLink>
        <div className={styles.titleBox}>
          <p className={`${styles.kicker} hud-label`}>
            <span>
              Page <strong>{current}</strong> of {comic.total}
            </span>
            {fan ? <CanonBadge canon={comic.canon} /> : null}
          </p>
          <p className={`${styles.title} display`} aria-hidden="true">
            {comic.title}
          </p>
        </div>
        <label className={styles.jump}>
          <span className="hud-label">Go to</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            className={styles.pageInput}
            value={draft ?? String(current)}
            aria-label={`Page, 1 to ${comic.total}`}
            onChange={(e) => {
              setDraft(e.target.value.replace(/\D/gu, "").slice(0, 4));
            }}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            onBlur={() => {
              setDraft(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") jump(e.currentTarget.value);
            }}
          />
        </label>
        {textSwitch}
      </div>

      {/* The one mark of progress, a hairline along the top of the screen. */}
      <span className={styles.progress} aria-hidden="true">
        <span ref={fillRef} className={styles.fill} />
      </span>

      {/* The one button the controls fold into, and the list it opens. */}
      <Popover.Root open={menuOpen && away} onOpenChange={setMenuOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={styles.fold}
            data-in={away ? "true" : undefined}
            aria-label="Reader controls"
            tabIndex={away ? 0 : -1}
            onClick={() => {
              audio.blip("click");
            }}
          >
            <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
              <path d="M2 5h14M2 9h14M2 13h9" stroke="currentColor" strokeWidth="1.7" fill="none" />
            </svg>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className={styles.panel}
            data-theme="storm"
            align="start"
            side="bottom"
            sideOffset={10}
            collisionPadding={12}
            data-lenis-prevent
          >
            <p className={`${styles.panelKicker} hud-label`}>
              Page {current} of {comic.total}
              {fan ? <CanonBadge canon={comic.canon} /> : null}
            </p>
            <p className={`${styles.panelTitle} display`}>{comic.title}</p>
            <TLink
              href={backHref}
              transitionLabel="Comics"
              className={styles.panelRow}
              onClick={() => {
                setMenuOpen(false);
              }}
            >
              <Icon d="M10 2L4 8l6 6" />
              <span>Back to the shelf</span>
            </TLink>
            <label className={styles.panelRow}>
              <span>Page</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className={styles.pageInput}
                value={draft ?? String(current)}
                aria-label={`Go to page, 1 to ${comic.total}`}
                onChange={(e) => {
                  setDraft(e.target.value.replace(/\D/gu, "").slice(0, 4));
                }}
                onFocus={(e) => {
                  e.currentTarget.select();
                }}
                onBlur={() => {
                  setDraft(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") jump(e.currentTarget.value);
                }}
              />
              <span className={styles.of}>of {comic.total}</span>
            </label>
            {textSwitch}
            {fan ? (
              <ReportLink item={{ id: comic.id, title: comic.title }} className={styles.report} />
            ) : null}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <div className={styles.main}>
        <div
          ref={scrollerRef}
          className={styles.scroller}
          tabIndex={0}
          role="region"
          aria-label={`${comic.title}, pages`}
          data-lenis-prevent
        >
          {/* Room for the top bar and the control bar, which are there at the very top only. */}
          <div className={styles.top} aria-hidden="true" />
          {comic.missing.length > 0 ? (
            <p className={styles.notice}>
              Pages {listNumbers(comic.missing)} are missing in the source. The numbers of the
              original are kept.
            </p>
          ) : null}
          <div ref={stripRef} className={styles.strip} style={{ "--zoom": zoom } as CSSProperties}>
            {sequence.map((e, i) =>
              e.kind === "page" ? (
                <PageView
                  key={e.n}
                  comic={comic}
                  page={e.page}
                  eager={Math.abs(i - startIndex) <= 1}
                  shownWidth={Math.min(colW, MAX_PAGE_W, e.page.w) * zoom}
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
            <div className={styles.neighbours}>
              {prev ? <Neighbour comic={prev} dir="prev" /> : <span />}
              {next ? <Neighbour comic={next} dir="next" /> : <span />}
            </div>
            <TLink href={backHref} transitionLabel="Comics" className={styles.btn}>
              Back to the shelf
            </TLink>
            {fan ? (
              <ReportLink item={{ id: comic.id, title: comic.title }} className={styles.report} />
            ) : null}
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

      {/* Zoom: a small pill in the corner. */}
      <div className={styles.zoom} role="group" aria-label="Zoom">
        <button
          type="button"
          onClick={() => {
            changeZoom(-1);
          }}
          disabled={zoom <= ZOOM_MIN}
          aria-label="Zoom out"
          title="Zoom out (-)"
        >
          <Icon d="M3 8h10" />
        </button>
        <span className={`${styles.zoomValue} hud-label`} aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => {
            changeZoom(1);
          }}
          disabled={zoom >= ZOOM_MAX}
          aria-label="Zoom in"
          title="Zoom in (+)"
        >
          <Icon d="M3 8h10M8 3v10" />
        </button>
      </div>
    </main>
  );
}
