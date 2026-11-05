"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { useTransitionRouter } from "@/components/transition/transition-provider";
import { audio } from "@/lib/audio";
import { expectReady } from "@/lib/page-ready";
import { collectionRoute } from "@/lib/site";

import { fetchLibraryJson } from "../data";
import { COLLECTIONS } from "../registry";
import { SearchButton } from "../search/search-host";
import { useLibrarySearch } from "../search/search-store";
import { drawCover, getCoverBitmap, holdCoverBitmaps, loadCoverFonts } from "./cover-art";
import { ShelfEngine, type Rect } from "./engine";
import { COVER_COUNT, ENTRANCE_MS, formatCount, isPhone, moveIndex, type ArrowKey } from "./layout";
import styles from "./shelf.module.css";

const ARROWS: readonly string[] = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

/** Wait for the loading curtain to open (the first visit or a page change). Returns the way to stop waiting. */
function whenCurtainOpen(): { promise: Promise<void>; cancel: () => void } {
  let cancel: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    const el = document.querySelector<HTMLElement>("[data-mode][data-active]");
    if (el?.dataset.active !== "true") {
      resolve();
      return;
    }
    const obs = new MutationObserver(() => {
      if (el.dataset.active !== "true") {
        obs.disconnect();
        resolve();
      }
    });
    obs.observe(el, { attributes: true, attributeFilter: ["data-active"] });
    cancel = () => {
      obs.disconnect();
    };
  });
  return { promise, cancel: () => cancel() };
}

interface Props {
  /** The scene could not start: the page shows the plain grid instead. */
  onFail: () => void;
}

/**
 * The shelf: one full screen WebGL scene (`engine.ts`) with the words and the buttons laid over
 * it as real HTML. The scene draws the covers, the shelves, the shadows and the blur; this
 * component owns what is hovered and what is focused, the keys, the index row and the way into
 * a room. It reports to the loading curtain (`expectReady`) until the first frame is drawn.
 */
export default function ShelfScene({ onFail }: Props) {
  const router = useTransitionRouter();
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const engineRef = useRef<ShelfEngine | null>(null);
  const anchors = useRef<Array<HTMLAnchorElement | null>>([]);

  const [focused, setFocused] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [phone, setPhone] = useState(false);
  const [front, setFront] = useState(0);
  const [entered, setEntered] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [lastFocused, setLastFocused] = useState(0);

  // The latest values for the scene's callbacks, which are made once.
  const focusedRef = useRef(focused);
  const activeRef = useRef(active);
  const phoneRef = useRef(phone);
  const frontRef = useRef(front);
  useEffect(() => {
    focusedRef.current = focused;
    activeRef.current = active;
    phoneRef.current = phone;
    frontRef.current = front;
  });

  const hoverIndex = useCallback((i: number | null, sound = true) => {
    if (activeRef.current === i) return;
    setActive(i);
    activeRef.current = i;
    if (sound && i !== null) audio.blip("hover");
  }, []);

  const focusCover = useCallback((i: number) => {
    setFocused(i);
    setLastFocused(i);
    focusedRef.current = i;
    setActive(i);
    activeRef.current = i;
    engineRef.current?.setFocus(i);
    if (phoneRef.current) engineRef.current?.setStack(i);
    audio.blip("click");
  }, []);

  const unfocus = useCallback(() => {
    if (focusedRef.current === null) return;
    setFocused(null);
    focusedRef.current = null;
    setActive(null);
    activeRef.current = null;
    engineRef.current?.setHover(null);
    engineRef.current?.setFocus(null);
    audio.blip("hover");
  }, []);

  const openCover = useCallback(
    (i: number) => {
      const meta = COLLECTIONS[i];
      if (!meta) return;
      audio.blip("click");
      router.push(collectionRoute(meta.slug), { label: meta.name });
    },
    [router],
  );

  // The scene -------------------------------------------------------------------------------------
  useEffect(() => {
    const host = hostRef.current;
    const stage = stageRef.current;
    if (!host || !stage) return;
    const mark = expectReady("library-shelf");
    const release = holdCoverBitmaps();
    let cancelled = false;
    let engine: ShelfEngine | null = null;
    let timer = 0;
    let curtain: ReturnType<typeof whenCurtainOpen> | null = null;
    let travel = 0;

    const place = (el: HTMLElement | null, x: number, y: number, anchor: string) => {
      if (el) el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) ${anchor}`;
    };
    const measure = () => {
      const track = trackRef.current;
      const thumb = thumbRef.current;
      travel = track && thumb ? Math.max(0, track.clientHeight - thumb.clientHeight) : 0;
    };

    void (async () => {
      try {
        await loadCoverFonts();
        const canvases = await Promise.all(
          COLLECTIONS.map(async (c) => ({ canvas: drawCover(c, await getCoverBitmap(c.cover)) })),
        );
        if (cancelled) return;
        engine = new ShelfEngine({
          host,
          pointerTarget: stage,
          covers: canvases,
          onHover: (i) => {
            hoverIndex(i);
          },
          onPick: (i) => {
            focusCover(i);
          },
          onOpen: (i) => {
            openCover(i);
          },
          onBack: () => {
            unfocus();
          },
          onFront: (i) => {
            setFront(i);
            if (focusedRef.current === null) hoverIndex(i, false);
          },
          onStack: (s) => {
            const thumb = thumbRef.current;
            if (thumb)
              thumb.style.transform = `translate3d(0, ${((s / (COVER_COUNT - 1)) * travel).toFixed(1)}px, 0)`;
          },
          onLayout: (hover: Rect | null, focus: Rect | null) => {
            if (hover)
              place(
                pillsRef.current,
                (hover.left + hover.right) / 2,
                hover.bottom + 1,
                "translate(-50%, -50%)",
              );
            if (focus)
              place(
                openRef.current,
                (focus.left + focus.right) / 2,
                focus.bottom + 20,
                "translate(-50%, 0)",
              );
          },
        });
        engineRef.current = engine;
        setPhone(engine.isPhone);
        measure();
        // The first frame is drawn (the ground and the shelves, the covers waiting above): the curtain may open.
        mark();
        curtain = whenCurtainOpen();
        await curtain.promise;
        if (cancelled) return;
        engine.playEntrance();
        timer = window.setTimeout(
          () => {
            setEntered(true);
          },
          Math.max(0, ENTRANCE_MS - 220),
        );
      } catch (error) {
        console.warn("The shelf scene could not start, showing the list.", error);
        mark();
        if (!cancelled) onFail();
      }
    })();

    const ro = new ResizeObserver(() => {
      setPhone(isPhone(stage.clientWidth));
      measure();
    });
    ro.observe(stage);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      curtain?.cancel();
      ro.disconnect();
      engine?.dispose();
      engineRef.current = null;
      release();
      mark();
    };
    // The callbacks read the latest state through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The counts under the names, when the library index exists. Missing is fine: they stay hidden.
  useEffect(() => {
    let live = true;
    fetchLibraryJson<{ counts?: Record<string, number> }>("/data/library/index.json").then(
      (index) => {
        if (live && index.counts) setCounts(index.counts);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);

  // Keys ----------------------------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (useLibrarySearch.getState().open) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('[role="dialog"], input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === "Escape") {
        if (focusedRef.current !== null) {
          e.preventDefault();
          unfocus();
        }
        return;
      }
      if (ARROWS.includes(e.key)) {
        e.preventDefault();
        const from =
          focusedRef.current ?? activeRef.current ?? (phoneRef.current ? frontRef.current : null);
        const next = moveIndex(from, e.key as ArrowKey, phoneRef.current);
        if (focusedRef.current !== null) focusCover(next);
        else {
          hoverIndex(next);
          if (phoneRef.current) engineRef.current?.setStack(next);
        }
        engineRef.current?.setHover(next);
        anchors.current[next]?.focus({ preventScroll: true });
        return;
      }
      if (e.key === "Enter") {
        const el = document.activeElement;
        if (el && el !== document.body && el.closest("a, button")) return;
        if (focusedRef.current !== null) openCover(focusedRef.current);
        else if (activeRef.current !== null) focusCover(activeRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [focusCover, hoverIndex, openCover, unfocus]);

  // The phone's scroll bar: drag the thumb, or press the track.
  const onTrack = (e: ReactPointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const engine = engineRef.current;
    if (!track || !engine) return;
    if (e.type === "pointerup" || e.type === "pointercancel") {
      engine.releaseStackThumb();
      return;
    }
    if (e.type === "pointerdown") track.setPointerCapture(e.pointerId);
    else if (e.buttons === 0) return;
    const r = track.getBoundingClientRect();
    engine.setStackFraction(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
  };

  const shown = focused ?? lastFocused;
  const cur = focused ?? active ?? (phone ? front : null);
  const meta = COLLECTIONS[phone ? (focused ?? front) : shown];
  const countOf = (slug: string) => formatCount(counts[slug]);
  const pillsOn = active !== null && focused === null && !phone;

  return (
    <div
      ref={stageRef}
      className={styles.stage}
      data-phone={phone ? "true" : undefined}
      data-focus={focused !== null ? "true" : undefined}
      data-entered={entered ? "true" : undefined}
    >
      <h1 className="sr-only">Collection</h1>
      <div ref={hostRef} className={styles.gl} aria-hidden="true" />

      <div className={styles.top}>
        <p className={styles.tagline}>
          Everything made for Aspirant.
          <br />
          In ten rooms.
        </p>
        <SearchButton className={styles.search} />
      </div>

      <div ref={pillsRef} className={styles.pills} data-show={pillsOn ? "true" : "false"}>
        <button
          type="button"
          className={`${styles.pill} ${styles.light}`}
          tabIndex={pillsOn ? 0 : -1}
          onClick={() => {
            if (active !== null) focusCover(active);
          }}
        >
          Details
        </button>
        <button
          type="button"
          className={`${styles.pill} ${styles.dark}`}
          tabIndex={pillsOn ? 0 : -1}
          onClick={() => {
            if (active !== null) openCover(active);
          }}
        >
          Open
        </button>
      </div>

      <div
        className={styles.copy}
        data-show={focused !== null ? "true" : "false"}
        aria-live="polite"
      >
        {meta ? (
          <>
            <p className={styles.copyNum}>{meta.index}</p>
            <h2 className={styles.copyName}>{meta.name}</h2>
            <p className={styles.copyLine}>{meta.tagline}</p>
            {countOf(meta.slug) ? (
              <p className={styles.copyCount}>{countOf(meta.slug)} items</p>
            ) : null}
          </>
        ) : null}
      </div>

      <div
        ref={openRef}
        className={styles.openWrap}
        data-show={focused !== null ? "true" : "false"}
      >
        <button
          type="button"
          className={`${styles.pill} ${styles.dark}`}
          tabIndex={focused !== null ? 0 : -1}
          onClick={() => {
            if (focused !== null) openCover(focused);
          }}
        >
          Open
        </button>
      </div>

      <div className={styles.bar} data-show={phone ? "true" : "false"}>
        <div className={styles.barText}>
          <span className={styles.barNum}>{meta?.index}</span>
          <strong className={styles.barName}>{meta?.name}</strong>
          <span className={styles.barLine}>
            {focused !== null ? meta?.tagline : countOf(meta?.slug ?? "")}
          </span>
        </div>
        <div className={styles.barActions}>
          <button
            type="button"
            className={`${styles.pill} ${styles.light}`}
            onClick={() => {
              focusCover(front);
            }}
          >
            Details
          </button>
          <button
            type="button"
            className={`${styles.pill} ${styles.dark}`}
            onClick={() => {
              openCover(focused ?? front);
            }}
          >
            Open
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className={styles.track}
        data-ui=""
        data-show={phone && focused === null ? "true" : "false"}
        onPointerDown={onTrack}
        onPointerMove={onTrack}
        onPointerUp={onTrack}
        onPointerCancel={onTrack}
      >
        <span ref={thumbRef} className={styles.thumb} />
      </div>

      <nav
        className={styles.index}
        aria-label="The ten collections"
        data-phone={phone ? "true" : undefined}
      >
        <ol className={styles.entries}>
          {COLLECTIONS.map((c, i) => (
            <li key={c.slug}>
              <a
                ref={(el) => {
                  anchors.current[i] = el;
                }}
                href={collectionRoute(c.slug)}
                className={styles.entry}
                data-shelf-entry={c.slug}
                data-active={cur === i ? "true" : undefined}
                style={{ "--room": c.colour } as CSSProperties}
                tabIndex={i === (cur ?? 0) ? 0 : -1}
                onClick={(e) => {
                  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  if (focusedRef.current === i) openCover(i);
                  else focusCover(i);
                }}
                onPointerEnter={(e) => {
                  if (e.pointerType === "touch" || focusedRef.current !== null) return;
                  hoverIndex(i);
                  engineRef.current?.setHover(i);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === "touch" || focusedRef.current !== null) return;
                  hoverIndex(null, false);
                  engineRef.current?.setHover(null);
                }}
                onFocus={(e) => {
                  if (!e.currentTarget.matches(":focus-visible") || focusedRef.current !== null)
                    return;
                  hoverIndex(i);
                  engineRef.current?.setHover(i);
                  if (phoneRef.current) engineRef.current?.setStack(i);
                }}
                onBlur={() => {
                  if (focusedRef.current !== null) return;
                  hoverIndex(null, false);
                  engineRef.current?.setHover(null);
                }}
              >
                <span className={styles.entryNum}>{c.index}</span>
                <span className={styles.entryName}>{c.name}</span>
                <span className={styles.entryCount}>{countOf(c.slug)}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
