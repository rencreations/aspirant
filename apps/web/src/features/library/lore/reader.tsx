"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { TLink } from "@/components/transition/t-link";
import { audio } from "@/lib/audio";
import { characterRoute } from "@/lib/site";
import { CHARACTER_NAMES } from "@/lib/slugs";

import { activeIndex, minutesLeft, readProgress } from "./reader-math";
import styles from "./reader.module.css";
import { outline } from "./search";
import { TextBody } from "./text-body";
import { GROUP_TITLE, type AtlasItem, type LoreText } from "./types";

type Size = "s" | "m" | "l";
const SIZE_KEY = "aspirants:lore:size";
const SIZE_EVENT = "aspirants:lore:size-change";

/** Kept for this visit when the browser will not store it. */
let memorySize: Size | null = null;

function readSize(): Size {
  if (memorySize) return memorySize;
  try {
    const v = window.localStorage.getItem(SIZE_KEY);
    if (v === "s" || v === "m" || v === "l") return v;
  } catch {
    // Private windows and blocked storage: the default size stays.
  }
  return "m";
}

function subscribeSize(onChange: () => void): () => void {
  window.addEventListener(SIZE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SIZE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const serverSize = (): Size => "m";

function useTextSize(): [Size, (next: Size) => void] {
  const size = useSyncExternalStore(subscribeSize, readSize, serverSize);
  const set = useCallback((next: Size) => {
    memorySize = next;
    try {
      window.localStorage.setItem(SIZE_KEY, next);
    } catch {
      // Not saved; it still applies to this visit.
    }
    window.dispatchEvent(new Event(SIZE_EVENT));
  }, []);
  return [size, set];
}

export interface ReaderProps {
  text: LoreText;
  prev: LoreText | null;
  next: LoreText | null;
  /** Lookup of any text by id (for the "also in" link). */
  byId: ReadonlyMap<string, LoreText>;
  atlas: readonly AtlasItem[];
  terms: readonly string[];
  onClose: () => void;
  onOpen: (id: string) => void;
  onPlace: (id: string) => void;
}

/**
 * The reading room for one text: a contents rail that follows the scroll, a column at a reading
 * measure, a text size control, deep links to every heading, and the next and previous text.
 */
export function Reader({
  text,
  prev,
  next,
  byId,
  atlas,
  terms,
  onClose,
  onOpen,
  onPlace,
}: ReaderProps) {
  const rootRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const railFill = useRef<HTMLSpanElement>(null);
  const barFill = useRef<HTMLSpanElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const leftRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const [size, setSize] = useTextSize();
  const [copied, setCopied] = useState(false);
  const { scrollTo } = useLenis();

  const heads = useMemo(() => outline(text.blocks).filter((h) => h.level <= 3), [text]);
  const places = useMemo(
    () =>
      text.places
        .map((id) => atlas.find((a) => a.id === id))
        .filter((a): a is AtlasItem => !!a && a.kind === "place"),
    [text, atlas],
  );
  const also = text.also ? byId.get(text.also) : undefined;

  const scrollToEl = useCallback(
    (el: Element, immediate: boolean) => {
      const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
      if (immediate) {
        // A plain jump: the native scroll, which the smooth scroller follows.
        window.scrollTo({
          top: el.getBoundingClientRect().top + window.scrollY - margin,
          behavior: "auto",
        });
        return;
      }
      scrollTo(el as HTMLElement, { offset: -margin, duration: 0.9 });
    },
    [scrollTo],
  );

  const jumpTo = useCallback(
    (id: string, immediate: boolean) => {
      const el = bodyRef.current?.querySelector(`[data-heading="${CSS.escape(id)}"]`);
      if (!el) return false;
      scrollToEl(el, immediate);
      return true;
    },
    [scrollToEl],
  );

  // Open at the top of the reader, or at the heading named in the address. The jump is made
  // again once the page has settled (fonts and pictures move the layout), unless the reader
  // has already scrolled somewhere else.
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    let placed = -1;
    const go = (retry: boolean) => {
      if (retry && Math.abs(window.scrollY - placed) > 4) return;
      if (!(hash && jumpTo(hash, true)) && rootRef.current) scrollToEl(rootRef.current, true);
      placed = window.scrollY;
    };
    const first = window.setTimeout(() => {
      go(false);
    }, 30);
    const second = window.setTimeout(() => {
      go(true);
    }, 500);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [text.id, jumpTo, scrollToEl]);

  // Progress (transform only) and the active heading.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const els = heads.map((h) => body.querySelector(`[data-heading="${CSS.escape(h.id)}"]`));
    let raf = 0;
    let lastPct = -1;
    let lastActive = -2;
    const update = () => {
      raf = 0;
      const rect = body.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = readProgress(rect.top, rect.height, vh);
      if (railFill.current) railFill.current.style.transform = `scaleY(${p.toFixed(4)})`;
      if (barFill.current) barFill.current.style.transform = `scaleX(${p.toFixed(4)})`;
      const pct = Math.round(p * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        if (pctRef.current) pctRef.current.textContent = `${pct}%`;
        if (leftRef.current)
          leftRef.current.textContent = `${minutesLeft(text.minutes, p)} min left`;
      }
      const idx = activeIndex(
        els.map((el) => (el ? el.getBoundingClientRect().top : Number.POSITIVE_INFINITY)),
        Math.max(220, vh * 0.3),
      );
      if (idx !== lastActive) {
        lastActive = idx;
        setActive(idx >= 0 ? (heads[idx]?.id ?? null) : null);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [heads, text.minutes]);

  // Esc goes back to the library.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (document.querySelector("[role='dialog']")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const goHeading = (id: string) => {
    audio.blip("click");
    jumpTo(id, false);
    const url = new URL(window.location.href);
    url.hash = id;
    window.history.replaceState(window.history.state, "", url);
  };

  const copyLink = async () => {
    audio.blip("click");
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      // Clipboard blocked: the address bar still holds the link.
    }
  };

  const tools = (
    <div className={styles.tools}>
      <div className={styles.sizes} role="group" aria-label="Text size">
        {(["s", "m", "l"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={styles.sizeBtn}
            data-size={s}
            aria-pressed={size === s}
            aria-label={s === "s" ? "Smaller text" : s === "m" ? "Medium text" : "Larger text"}
            onClick={() => {
              audio.blip("click");
              setSize(s);
            }}
          >
            A
          </button>
        ))}
      </div>
      <button type="button" className={styles.copy} onClick={() => void copyLink()}>
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );

  return (
    <article
      ref={rootRef}
      className={styles.room}
      data-size={size}
      aria-labelledby="lore-reader-title"
    >
      <header className={styles.head}>
        <p className={`${styles.crumb} hud-label`}>
          <button type="button" className={styles.crumbBtn} onClick={onClose}>
            Texts
          </button>
          <span aria-hidden="true">/</span>
          <span>{GROUP_TITLE[text.group]}</span>
        </p>
        <h2 id="lore-reader-title" className={`${styles.title} display`}>
          {text.title}
        </h2>
        <p className={styles.lead}>{text.summary}</p>
        <ul className={`${styles.meta} hud-label`}>
          <li>{text.minutes} min read</li>
          <li>{text.words.toLocaleString("en-US")} words</li>
          {text.rank === "older" ? <li className={styles.flagOlder}>Older text</li> : null}
          {text.group === "stories" ? (
            <li className={styles.flagPlot}>Tells part of the plot</li>
          ) : null}
        </ul>
        {text.rank === "older" ? (
          <p className={styles.callout}>
            This is one of the two oldest official texts. Where it differs from a newer text, the
            newer text is the reference.
          </p>
        ) : null}
        {also ? (
          <p className={styles.callout}>
            This story is also the first part of{" "}
            <button
              type="button"
              className={styles.inline}
              onClick={() => {
                onOpen(also.id);
              }}
            >
              {also.title}
            </button>
            .
          </p>
        ) : null}
      </header>

      <div className={styles.cols}>
        <nav className={styles.rail} aria-label="Contents of this text">
          <button type="button" className={styles.back} onClick={onClose}>
            <span aria-hidden="true" className={styles.backArrow} />
            All texts
          </button>
          <p className={`${styles.railLabel} hud-label`}>Contents</p>
          <div className={styles.tocWrap}>
            <span className={styles.track} aria-hidden="true">
              <span ref={railFill} className={styles.trackFill} />
            </span>
            {heads.length > 0 ? (
              <ol className={styles.toc}>
                {heads.map((h) => (
                  <li key={h.id} data-level={h.level} data-active={active === h.id ? "1" : "0"}>
                    <a
                      href={`#${h.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        goHeading(h.id);
                      }}
                      aria-current={active === h.id ? "location" : undefined}
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.noToc}>One continuous text.</p>
            )}
          </div>
          <p className={`${styles.meter} hud-label`} aria-hidden="true">
            <span ref={pctRef}>0%</span>
            <span ref={leftRef}>{text.minutes} min left</span>
          </p>
          {tools}
        </nav>

        <div className={styles.page}>
          <div ref={bodyRef}>
            <TextBody blocks={text.blocks} terms={terms} />
          </div>

          <nav className={styles.pager} aria-label="Previous and next text">
            {prev ? (
              <button
                type="button"
                className={styles.pagerBtn}
                onClick={() => {
                  onOpen(prev.id);
                }}
              >
                <span className="hud-label">Previous</span>
                <span className={`${styles.pagerTitle} display`}>{prev.title}</span>
                <span className={styles.pagerLine}>{GROUP_TITLE[prev.group]}</span>
              </button>
            ) : (
              <span />
            )}
            {next ? (
              <button
                type="button"
                className={`${styles.pagerBtn} ${styles.pagerNext}`}
                onClick={() => {
                  onOpen(next.id);
                }}
              >
                <span className="hud-label">Next</span>
                <span className={`${styles.pagerTitle} display`}>{next.title}</span>
                <span className={styles.pagerLine}>{GROUP_TITLE[next.group]}</span>
              </button>
            ) : (
              <span />
            )}
          </nav>
        </div>

        <aside className={styles.aside} aria-label="Mentioned in this text">
          {text.chars.length > 0 ? (
            <section>
              <h3 className="hud-label">Aspirants in this text</h3>
              <ul className={styles.chipList}>
                {text.chars.map((c) => (
                  <li key={c}>
                    <TLink
                      href={characterRoute(c)}
                      transitionLabel={CHARACTER_NAMES[c]}
                      className={styles.chip}
                    >
                      {CHARACTER_NAMES[c]}
                    </TLink>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {places.length > 0 ? (
            <section>
              <h3 className="hud-label">Places in this text</h3>
              <ul className={styles.chipList}>
                {places.slice(0, 12).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={styles.chip}
                      onClick={() => {
                        onPlace(p.id);
                      }}
                    >
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      <div className={styles.bar} aria-hidden="true">
        <span ref={barFill} className={styles.barFill} />
      </div>
    </article>
  );
}
