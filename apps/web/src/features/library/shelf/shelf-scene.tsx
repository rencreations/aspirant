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
import type { VideoRoom } from "../types";
import { FILM_IDS } from "../video/links";
import { drawCover, getCoverBitmap, holdCoverBitmaps, loadCoverFonts } from "./cover-art";
import { ShelfEngine, type Half, type Rect } from "./engine";
import {
  COVER_COUNT,
  ENTRANCE_MS,
  SPLIT_ROOM,
  formatCount,
  isPhone,
  moveHalf,
  moveIndex,
  splitGeometry,
  type ArrowKey,
} from "./layout";
import styles from "./shelf.module.css";
import { VIDEO_HALVES, VIDEO_SLUG, halfCounts } from "./video-halves";

const ARROWS: readonly string[] = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

/** The cover that opens in two. */
const VIDEO = Math.max(
  0,
  COLLECTIONS.findIndex((c) => c.slug === VIDEO_SLUG),
);

/** Where the Video cover is: shut, on its way open, open, or on its way shut. */
type SplitState = "shut" | "opening" | "open" | "closing";

/** The address of the shelf with the Video cover open (`?open=video`) or shut. */
function writeOpen(open: boolean): void {
  const u = new URL(window.location.href);
  if (open) u.searchParams.set("open", VIDEO_SLUG);
  else u.searchParams.delete("open");
  const next = `${u.pathname}${u.search}${u.hash}`;
  const now = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== now) window.history.replaceState(window.history.state, "", next);
}

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

interface LibraryIndex {
  counts?: Record<string, number>;
  /** Items in each room of a collection that has more than one (`video/films`, `video/others`). */
  rooms?: Record<string, number>;
}

/**
 * The shelf: one full screen WebGL scene (`engine.ts`) with the words and the buttons laid over
 * it as real HTML. The scene draws the covers, the shelves, the shadows and the blur; this
 * component owns what is hovered and what is focused, the keys, the index row and the way into
 * a room. It reports to the loading curtain (`expectReady`) until the first frame is drawn.
 *
 * The Video cover does not lead to a room: it opens in two (a gatefold drawn by the scene), Films
 * and Others, each with its line and its Open button. The open cover is in the address
 * (`?open=video`), so the browser's Back from a Video room comes back to it.
 */
export default function ShelfScene({ onFail }: Props) {
  const router = useTransitionRouter();
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const halfRefs = useRef<Array<HTMLDivElement | null>>([]);
  const halfButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const engineRef = useRef<ShelfEngine | null>(null);
  const anchors = useRef<Array<HTMLAnchorElement | null>>([]);

  const [focused, setFocused] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [phone, setPhone] = useState(false);
  const [front, setFront] = useState(0);
  const [entered, setEntered] = useState(false);
  const [index, setIndex] = useState<LibraryIndex>({});
  const [lastFocused, setLastFocused] = useState(0);
  const [split, setSplit] = useState<SplitState>("shut");
  const [half, setHalf] = useState<Half | null>(null);
  const [halfSize, setHalfSize] = useState(0);
  const [stacked, setStacked] = useState(false);

  // The latest values for the scene's callbacks, which are made once.
  const focusedRef = useRef(focused);
  const activeRef = useRef(active);
  const phoneRef = useRef(phone);
  const frontRef = useRef(front);
  /** The Video cover is open, or opening (the target, not where the motion is). */
  const splitRef = useRef(false);
  /** The half the keyboard chose, and the one the pointer is over. */
  const keyHalf = useRef<Half | null>(null);
  const pointerHalf = useRef<Half | null>(null);
  /** The halves are stacked (a tall phone): the arrows go up and down between them. */
  const verticalRef = useRef(false);
  /** The cover was opened from the keyboard: the focus moves to its first Open once it has opened. */
  const focusOnOpen = useRef(false);
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

  const showHalf = useCallback(() => {
    const h = pointerHalf.current ?? keyHalf.current;
    setHalf(h);
  }, []);

  /** Open the Video cover into its two halves. */
  const openSplit = useCallback((fromKeys = false) => {
    const engine = engineRef.current;
    setFocused(VIDEO);
    setLastFocused(VIDEO);
    focusedRef.current = VIDEO;
    setActive(VIDEO);
    activeRef.current = VIDEO;
    engine?.setFocus(VIDEO);
    if (phoneRef.current) engine?.setStack(VIDEO);
    if (splitRef.current) return;
    splitRef.current = true;
    keyHalf.current = null;
    pointerHalf.current = null;
    setHalf(null);
    setSplit("opening");
    focusOnOpen.current = fromKeys;
    engine?.setHalf(null);
    engine?.setSplit(true);
    writeOpen(true);
    audio.blip("click");
  }, []);

  /** Shut the Video cover (the scene closes it, then lets it fly back to the shelf). */
  const shutSplit = useCallback(() => {
    if (!splitRef.current) return false;
    splitRef.current = false;
    keyHalf.current = null;
    pointerHalf.current = null;
    setHalf(null);
    setSplit("closing");
    focusOnOpen.current = false;
    engineRef.current?.setHalf(null);
    engineRef.current?.setSplit(false);
    writeOpen(false);
    // The focus was on a button of the open cover: give it to the Video entry of the index row.
    const el = document.activeElement;
    if (el instanceof HTMLElement && el.closest("[data-split-ui]"))
      anchors.current[VIDEO]?.focus({ preventScroll: true });
    return true;
  }, []);

  const focusCover = useCallback(
    (i: number, fromKeys = false) => {
      if (i === VIDEO) {
        openSplit(fromKeys);
        return;
      }
      shutSplit();
      setFocused(i);
      setLastFocused(i);
      focusedRef.current = i;
      setActive(i);
      activeRef.current = i;
      engineRef.current?.setFocus(i);
      if (phoneRef.current) engineRef.current?.setStack(i);
      audio.blip("click");
    },
    [openSplit, shutSplit],
  );

  const unfocus = useCallback(() => {
    if (focusedRef.current === null) return;
    shutSplit();
    setFocused(null);
    focusedRef.current = null;
    setActive(null);
    activeRef.current = null;
    engineRef.current?.setHover(null);
    engineRef.current?.setFocus(null);
    audio.blip("hover");
  }, [shutSplit]);

  const openCover = useCallback(
    (i: number, fromKeys = false) => {
      const meta = COLLECTIONS[i];
      if (!meta) return;
      // The Video cover opens in two instead of leading to a room.
      if (i === VIDEO) {
        openSplit(fromKeys);
        return;
      }
      audio.blip("click");
      router.push(collectionRoute(meta.slug), { label: meta.name });
    },
    [openSplit, router],
  );

  const openHalf = useCallback(
    (h: Half) => {
      const room = VIDEO_HALVES[h];
      audio.blip("click");
      router.push(room.href, { label: room.name });
    },
    [router],
  );

  const chooseHalf = useCallback(
    (h: Half, fromKeys: boolean) => {
      keyHalf.current = h;
      engineRef.current?.setHalf(h);
      showHalf();
      if (fromKeys) halfButtons.current[h]?.focus({ preventScroll: true });
    },
    [showHalf],
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
    // `/collection?open=video` opens on the two halves (the browser's Back from a Video room).
    const startOpen = new URLSearchParams(window.location.search).get("open") === VIDEO_SLUG;

    const place = (el: HTMLElement | null, x: number, y: number, anchor: string) => {
      if (el) el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) ${anchor}`;
    };
    const measure = () => {
      const track = trackRef.current;
      const thumb = thumbRef.current;
      travel = track && thumb ? Math.max(0, track.clientHeight - thumb.clientHeight) : 0;
      const g = splitGeometry(stage.clientWidth, stage.clientHeight);
      verticalRef.current = g.vertical;
      setStacked(g.vertical);
      setHalfSize(g.size);
    };

    void (async () => {
      try {
        await loadCoverFonts();
        const [canvases, halves] = await Promise.all([
          Promise.all(
            COLLECTIONS.map(async (c) => ({
              canvas: drawCover(c, await getCoverBitmap(c.cover)),
            })),
          ),
          Promise.all(VIDEO_HALVES.map(async (h) => drawCover(h, await getCoverBitmap(h.cover)))),
        ]);
        if (cancelled) return;
        engine = new ShelfEngine({
          host,
          pointerTarget: stage,
          covers: canvases,
          split: { index: VIDEO, halves: [halves[0]!, halves[1]!], open: startOpen },
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
          onHalfHover: (h) => {
            pointerHalf.current = h;
            if (h !== null) audio.blip("hover");
            showHalf();
          },
          onHalfOpen: (h) => {
            openHalf(h);
          },
          onSplitLayout: (films, others) => {
            if (!films || !others) return;
            // The line and the Open button under each half, and Back under the pair. Side by
            // side the two lines share one baseline, whichever half is lifted.
            const below = Math.max(films.bottom, others.bottom);
            const oneAbove = films.bottom <= others.top;
            place(
              halfRefs.current[0] ?? null,
              films.left,
              (oneAbove ? films.bottom : below) + 14,
              "",
            );
            place(halfRefs.current[1] ?? null, others.left, below + 14, "");
            place(
              backRef.current,
              (Math.min(films.left, others.left) + Math.max(films.right, others.right)) / 2,
              below + SPLIT_ROOM.caption,
              "translate(-50%, 0)",
            );
          },
          onSplitSettled: (open) => {
            if (open !== splitRef.current) return;
            setSplit(open ? "open" : "shut");
          },
        });
        engineRef.current = engine;
        setPhone(engine.isPhone);
        measure();
        if (startOpen) {
          splitRef.current = true;
          setFocused(VIDEO);
          setLastFocused(VIDEO);
          focusedRef.current = VIDEO;
          setActive(VIDEO);
          activeRef.current = VIDEO;
          setFront(VIDEO);
          setSplit("open");
        }
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

  // Opened from the keyboard: once the halves and their buttons are on screen, the focus goes to
  // the Open button of the chosen half (Films unless the arrows came from the right).
  useEffect(() => {
    if (split !== "open" || !entered || !focusOnOpen.current) return;
    focusOnOpen.current = false;
    chooseHalf(keyHalf.current ?? 0, true);
  }, [split, entered, chooseHalf]);

  // The counts under the names, when the library index exists. Missing is fine: they stay hidden.
  useEffect(() => {
    let live = true;
    fetchLibraryJson<LibraryIndex>("/data/library/index.json").then(
      (data) => {
        if (live) setIndex(data);
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
        const key = e.key as ArrowKey;
        let next: number;
        if (splitRef.current) {
          // Inside the open Video cover the arrows go between its two halves. Past the first or
          // the last half they go on to the cover before or after it, as they do between covers.
          const v = verticalRef.current;
          const cur = keyHalf.current;
          const backward = key === (v ? "ArrowUp" : "ArrowLeft");
          const forward = key === (v ? "ArrowDown" : "ArrowRight");
          if (backward && cur === 0) next = VIDEO - 1;
          else if (forward && cur === 1) next = VIDEO + 1;
          else if (!v && !phoneRef.current && key === "ArrowDown") next = moveIndex(VIDEO, key);
          else {
            chooseHalf(moveHalf(cur, key, v), true);
            return;
          }
          if (next < 0 || next >= COVER_COUNT || next === VIDEO) return;
        } else {
          const from =
            focusedRef.current ?? activeRef.current ?? (phoneRef.current ? frontRef.current : null);
          next = moveIndex(from, key, phoneRef.current);
          if (focusedRef.current === null) {
            hoverIndex(next);
            if (phoneRef.current) engineRef.current?.setStack(next);
            engineRef.current?.setHover(next);
            anchors.current[next]?.focus({ preventScroll: true });
            return;
          }
          if (next === VIDEO && from !== null) {
            // Into the Video cover from a focused neighbour: it opens on the half nearest to it.
            focusCover(VIDEO, true);
            keyHalf.current = from < VIDEO ? 0 : 1;
            return;
          }
        }
        focusCover(next, true);
        engineRef.current?.setHover(next);
        anchors.current[next]?.focus({ preventScroll: true });
        return;
      }
      if (e.key === "Enter") {
        const el = document.activeElement;
        if (el && el !== document.body && el.closest("a, button")) return;
        if (splitRef.current) {
          if (keyHalf.current !== null) openHalf(keyHalf.current);
        } else if (focusedRef.current !== null) openCover(focusedRef.current, true);
        else if (activeRef.current !== null) focusCover(activeRef.current, true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [chooseHalf, focusCover, hoverIndex, openCover, openHalf, unfocus]);

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
  const counts = index.counts ?? {};
  const countOf = (slug: string) => formatCount(counts[slug]);
  const pillsOn = active !== null && focused === null && !phone;
  const isSplit = split !== "shut";
  const splitUp = split === "open" && entered;
  const [filmsCount, othersCount] = halfCounts(counts[VIDEO_SLUG], FILM_IDS.length, {
    films: index.rooms?.["video/films"],
    others: index.rooms?.["video/others"],
  } satisfies Partial<Record<VideoRoom, number>>);
  const halfCount = [
    filmsCount !== undefined ? `${formatCount(filmsCount)} films` : "",
    othersCount !== undefined ? `${formatCount(othersCount)} videos` : "",
  ];

  return (
    <div
      ref={stageRef}
      className={styles.stage}
      data-phone={phone ? "true" : undefined}
      data-focus={focused !== null ? "true" : undefined}
      data-entered={entered ? "true" : undefined}
      data-split={isSplit ? split : undefined}
      data-stacked={stacked ? "true" : undefined}
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
        data-show={focused !== null && !isSplit ? "true" : "false"}
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
        data-show={focused !== null && !isSplit ? "true" : "false"}
      >
        <button
          type="button"
          className={`${styles.pill} ${styles.dark}`}
          tabIndex={focused !== null && !isSplit ? 0 : -1}
          onClick={() => {
            if (focused !== null) openCover(focused);
          }}
        >
          Open
        </button>
      </div>

      {/* The open Video cover: under each half its line, its count and its Open button. */}
      <div className="sr-only" aria-live="polite">
        {splitUp ? "Video is open: Films and Others." : ""}
      </div>
      {VIDEO_HALVES.map((h, k) => (
        <div
          key={h.room}
          ref={(el) => {
            halfRefs.current[k] = el;
          }}
          className={styles.half}
          data-ui=""
          data-split-ui=""
          data-video-half={h.room}
          data-show={splitUp ? "true" : "false"}
          data-active={half === k ? "true" : undefined}
          style={{ width: halfSize || undefined }}
        >
          <p className={styles.halfLine}>{h.line}</p>
          <div className={styles.halfRow}>
            <span className={styles.halfCount}>{halfCount[k]}</span>
            <button
              ref={(el) => {
                halfButtons.current[k] = el;
              }}
              type="button"
              className={`${styles.pill} ${styles.dark}`}
              tabIndex={splitUp ? 0 : -1}
              aria-label={`Open Video ${h.name}`}
              data-video-open={h.room}
              onClick={() => {
                openHalf(k as Half);
              }}
              onFocus={(e) => {
                if (e.currentTarget.matches(":focus-visible")) chooseHalf(k as Half, false);
              }}
            >
              Open
            </button>
          </div>
        </div>
      ))}
      <div
        ref={backRef}
        className={styles.backWrap}
        data-ui=""
        data-split-ui=""
        data-show={splitUp && !phone ? "true" : "false"}
      >
        <button
          type="button"
          className={`${styles.pill} ${styles.ghost}`}
          tabIndex={splitUp && !phone ? 0 : -1}
          data-video-back=""
          onClick={() => {
            unfocus();
          }}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          Back
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
        <button
          type="button"
          className={`${styles.pill} ${styles.light} ${styles.barBack}`}
          data-split-ui=""
          data-video-back=""
          tabIndex={isSplit && phone ? 0 : -1}
          onClick={() => {
            unfocus();
          }}
        >
          Back
        </button>
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
                  // A click from the keyboard (Enter) has no pointer position.
                  const fromKeys = e.detail === 0;
                  if (focusedRef.current === i) openCover(i, fromKeys);
                  else focusCover(i, fromKeys);
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
