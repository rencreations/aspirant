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
import {
  COVER_COUNT,
  ENTRANCE_MS,
  backAt,
  captionAt,
  foldGeometry,
  formatCount,
  isPhone,
  isShort,
  moveIndex,
  movePart,
  splitCaption,
  type ArrowKey,
  type FoldGeometry,
} from "./layout";
import { measureObstacles } from "./obstacles";
import styles from "./shelf.module.css";
import { SPLITS, partCount, splitIndexOf, type LibraryIndex, type SplitSpec } from "./splits";

const ARROWS: readonly string[] = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

/** Every cover that opens into rooms (Arts into three, Video into two), with its place on the shelf. */
const OPENERS = SPLITS.map((spec) => ({
  spec,
  index: splitIndexOf(spec),
  n: partCount(spec),
  lineChars: Math.max(...spec.parts.map((p) => p.line.length)),
}));

type Opener = (typeof OPENERS)[number];

/** A row (a square with its words beside it) under this side is short: its line and its count are set tighter. */
const COMPACT_ROW = 128;

/** The opener of the cover at shelf slot `i`, if it opens. */
const openerAt = (i: number | null): Opener | undefined =>
  i === null ? undefined : OPENERS.find((o) => o.index === i);

/** Where an opening cover is: shut, on its way open, open, or on its way shut. */
type SplitState = "shut" | "opening" | "open" | "closing";

/** The address of the shelf with a cover open (`?open=video`, `?open=arts`) or shut. */
function writeOpen(slug: string | null): void {
  const u = new URL(window.location.href);
  if (slug) u.searchParams.set("open", slug);
  else u.searchParams.delete("open");
  const next = `${u.pathname}${u.search}${u.hash}`;
  const now = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== now) window.history.replaceState(window.history.state, "", next);
}

function sameGeo(a: Record<number, FoldGeometry>, b: Record<number, FoldGeometry>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Three parts side by side have lines of different lengths. Give their words one height (the
 * tallest) so the three Open buttons stand on one line. Returns that height, or 0 when there is none.
 */
function equalise(els: Array<HTMLElement | null>, on: boolean): number {
  const live = els.filter((el): el is HTMLElement => el !== null);
  for (const el of live) el.style.minHeight = "";
  if (!on) return 0;
  const tallest = Math.max(0, ...live.map((el) => el.offsetHeight));
  if (tallest > 0) for (const el of live) el.style.minHeight = `${tallest}px`;
  return tallest;
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

/**
 * The shelf: one full screen WebGL scene (`engine.ts`) with the words and the buttons laid over
 * it as real HTML. The scene draws the covers, the shelves, the shadows and the blur; this
 * component owns what is hovered and what is focused, the keys, the index row and the way into
 * a room. It reports to the loading curtain (`expectReady`) until the first frame is drawn.
 *
 * Two covers do not lead to a room: they open into rooms (`splits.ts`). Video is a gatefold of two
 * panels, Films and Others; Arts is a triptych of three, Official, Fanart and Cosplay. Each part has
 * its line, its count and its Open button. The open cover is in the address (`?open=video`,
 * `?open=arts`), so the browser's Back from one of its rooms comes back to it.
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
  const partRefs = useRef<Array<HTMLDivElement | null>>([]);
  const partButtons = useRef<Array<HTMLButtonElement | null>>([]);
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
  /** The cover that is open or was last open (its parts are the ones on the page). */
  const [splitCover, setSplitCover] = useState<number | null>(null);
  const [part, setPart] = useState<number | null>(null);
  const [geo, setGeo] = useState<Record<number, FoldGeometry>>({});
  const [short, setShort] = useState(false);

  // The latest values for the scene's callbacks, which are made once.
  const focusedRef = useRef(focused);
  const activeRef = useRef(active);
  const phoneRef = useRef(phone);
  const frontRef = useRef(front);
  /** The cover that is open or opening (the target, not where the motion is), or null. */
  const splitRef = useRef<number | null>(null);
  /** The part the keyboard chose, and the one the pointer is over. */
  const keyPart = useRef<number | null>(null);
  const pointerPart = useRef<number | null>(null);
  /** What the scene last laid out for each opening cover (read by the scene's callbacks). */
  const geoRef = useRef<Record<number, FoldGeometry>>({});
  /** The cover was opened from the keyboard: the focus moves to its first Open once it has opened. */
  const focusOnOpen = useRef(false);
  /** The height of the words under three parts side by side (0 when not measured). */
  const captionH = useRef(0);
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

  const showPart = useCallback(() => {
    setPart(pointerPart.current ?? keyPart.current);
  }, []);

  /** Open the cover at shelf slot `cover` into its parts. Another one that is open shuts first. */
  const openSplit = useCallback((cover: number, fromKeys = false) => {
    const opener = openerAt(cover);
    if (!opener) return;
    const engine = engineRef.current;
    setFocused(cover);
    setLastFocused(cover);
    focusedRef.current = cover;
    setActive(cover);
    activeRef.current = cover;
    engine?.setFocus(cover);
    if (phoneRef.current) engine?.setStack(cover);
    if (splitRef.current === cover) return;
    splitRef.current = cover;
    setSplitCover(cover);
    keyPart.current = null;
    pointerPart.current = null;
    setPart(null);
    setSplit("opening");
    focusOnOpen.current = fromKeys;
    engine?.setPart(null);
    engine?.setSplit(cover);
    writeOpen(opener.spec.slug);
    audio.blip("click");
  }, []);

  /** Shut the open cover (the scene closes it, then lets it fly back to the shelf). */
  const shutSplit = useCallback(() => {
    const was = splitRef.current;
    if (was === null) return false;
    splitRef.current = null;
    keyPart.current = null;
    pointerPart.current = null;
    setPart(null);
    setSplit("closing");
    focusOnOpen.current = false;
    engineRef.current?.setPart(null);
    engineRef.current?.setSplit(null);
    writeOpen(null);
    // The focus was on a button of the open cover: give it to that cover's entry of the index row.
    const el = document.activeElement;
    if (el instanceof HTMLElement && el.closest("[data-split-ui]"))
      anchors.current[was]?.focus({ preventScroll: true });
    return true;
  }, []);

  const focusCover = useCallback(
    (i: number, fromKeys = false) => {
      if (openerAt(i)) {
        openSplit(i, fromKeys);
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
      // A cover that opens in parts opens them instead of leading to a room.
      if (openerAt(i)) {
        openSplit(i, fromKeys);
        return;
      }
      audio.blip("click");
      router.push(collectionRoute(meta.slug), { label: meta.name });
    },
    [openSplit, router],
  );

  const openPart = useCallback(
    (cover: number, k: number) => {
      const room = openerAt(cover)?.spec.parts[k];
      if (!room) return;
      audio.blip("click");
      router.push(room.href, { label: room.name });
    },
    [router],
  );

  const choosePart = useCallback(
    (k: number, fromKeys: boolean) => {
      keyPart.current = k;
      engineRef.current?.setPart(k);
      showPart();
      if (fromKeys) partButtons.current[k]?.focus({ preventScroll: true });
    },
    [showPart],
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
    // `/collection?open=video` or `?open=arts` opens on the parts (the browser's Back from a room).
    const wanted = new URLSearchParams(window.location.search).get("open");
    const startOpener = OPENERS.find((op) => op.spec.slug === wanted);

    const place = (el: HTMLElement | null, x: number, y: number, anchor: string) => {
      if (el) el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) ${anchor}`;
    };
    const measure = () => {
      const track = trackRef.current;
      const thumb = thumbRef.current;
      travel = track && thumb ? Math.max(0, track.clientHeight - thumb.clientHeight) : 0;
      // The controls over the scene (the focused cover and the open cover keep clear of them),
      // measured once per layout, never per frame.
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const o = measureObstacles(stage);
      engineRef.current?.setObstacles(o);
      const next: Record<number, FoldGeometry> = {};
      for (const op of OPENERS) {
        next[op.index] = foldGeometry(op.n, w, h, o.navH, {
          short: o.short,
          above: o.splitAbove,
          lineChars: op.lineChars,
        });
      }
      geoRef.current = next;
      setGeo((prev) => (sameGeo(prev, next) ? prev : next));
      setShort(isShort(h));
    };

    void (async () => {
      try {
        await loadCoverFonts();
        const [canvases, inside] = await Promise.all([
          Promise.all(
            COLLECTIONS.map(async (c) => ({
              canvas: drawCover(c, await getCoverBitmap(c.cover)),
            })),
          ),
          Promise.all(
            OPENERS.map((op) =>
              Promise.all(
                op.spec.parts.map(async (p) => ({
                  id: p.id,
                  canvas: drawCover(p, await getCoverBitmap(p.cover)),
                })),
              ),
            ),
          ),
        ]);
        if (cancelled) return;
        engine = new ShelfEngine({
          host,
          pointerTarget: stage,
          covers: canvases,
          splits: OPENERS.map((op, k) => ({
            index: op.index,
            fold: op.spec.fold,
            parts: inside[k] ?? [],
            lineChars: op.lineChars,
            open: op === startOpener,
          })),
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
          onPartHover: (cover, k) => {
            if (cover !== splitRef.current) return;
            pointerPart.current = k;
            if (k !== null) audio.blip("hover");
            showPart();
          },
          onPartOpen: (cover, k) => {
            openPart(cover, k);
          },
          onSplitLayout: (cover, rects) => {
            if (!rects || cover !== splitRef.current) return;
            const g = geoRef.current[cover];
            const beside = g?.beside ?? false;
            // The line and the Open button under each part (or beside it, for rows), and Back under
            // the parts. Side by side the lines share one baseline, whichever part is lifted.
            rects.forEach((_, k) => {
              const at = captionAt(rects, k, beside);
              place(partRefs.current[k] ?? null, at.x, at.y, "");
            });
            // Back stands under the words: where they really end when three of them were measured.
            const tail =
              captionH.current > 0 && g && !beside
                ? 14 + captionH.current + 14
                : (g?.tail ?? splitCaption(stage.clientWidth, stage.clientHeight));
            const back = backAt(rects, tail);
            place(backRef.current, back.x, back.y, "translate(-50%, 0)");
          },
          onSplitSettled: (cover, open) => {
            if (open) {
              if (cover === splitRef.current) setSplit("open");
            } else if (splitRef.current === null) {
              setSplit("shut");
            }
          },
        });
        engineRef.current = engine;
        setPhone(engine.isPhone);
        measure();
        if (startOpener) {
          const at = startOpener.index;
          splitRef.current = at;
          setSplitCover(at);
          setFocused(at);
          setLastFocused(at);
          focusedRef.current = at;
          setActive(at);
          activeRef.current = at;
          setFront(at);
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
    // The words under the bar change size when the site's fonts arrive.
    void document.fonts?.ready.then(() => {
      if (!cancelled) measure();
    });

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

  // Opened from the keyboard: once the parts and their buttons are on screen, the focus goes to
  // the Open button of the chosen part (the first unless the arrows came from the right).
  useEffect(() => {
    if (split !== "open" || !entered || !focusOnOpen.current) return;
    focusOnOpen.current = false;
    choosePart(keyPart.current ?? 0, true);
  }, [split, entered, choosePart]);

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
        const open = openerAt(splitRef.current);
        if (open) {
          // Inside an open cover the arrows go between its parts. Past the first or the last part
          // they go on to the cover before or after it, as they do between covers.
          const v = geoRef.current[open.index]?.vertical ?? false;
          const cur = keyPart.current;
          const backward = key === (v ? "ArrowUp" : "ArrowLeft");
          const forward = key === (v ? "ArrowDown" : "ArrowRight");
          if (backward && cur === 0) next = open.index - 1;
          else if (forward && cur === open.n - 1) next = open.index + 1;
          else if (!v && !phoneRef.current && key === "ArrowDown")
            next = moveIndex(open.index, key);
          else {
            choosePart(movePart(cur, key, v, open.n), true);
            return;
          }
          if (next < 0 || next >= COVER_COUNT || next === open.index) return;
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
          if (openerAt(next) && from !== null) {
            // Into a cover that opens, from a focused neighbour: it opens on the part nearest to it.
            focusCover(next, true);
            keyPart.current = from < next ? 0 : (openerAt(next)?.n ?? 1) - 1;
            return;
          }
        }
        focusCover(next, true);
        // From inside an open cover into the next one that opens: the part nearest to where we came from.
        const into = openerAt(next);
        if (open && into) keyPart.current = open.index < next ? 0 : into.n - 1;
        engineRef.current?.setHover(next);
        anchors.current[next]?.focus({ preventScroll: true });
        return;
      }
      if (e.key === "Enter") {
        const el = document.activeElement;
        if (el && el !== document.body && el.closest("a, button")) return;
        if (splitRef.current !== null) {
          if (keyPart.current !== null) openPart(splitRef.current, keyPart.current);
        } else if (focusedRef.current !== null) openCover(focusedRef.current, true);
        else if (activeRef.current !== null) focusCover(activeRef.current, true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [choosePart, focusCover, hoverIndex, openCover, openPart, unfocus]);

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
  // The cover whose parts are on the page: the open one, or the last one that was open.
  const shownOpener = openerAt(splitCover) ?? OPENERS[0];
  const spec: SplitSpec | undefined = shownOpener?.spec;
  const shownGeo = shownOpener ? geo[shownOpener.index] : undefined;
  const rows = shownGeo?.beside === true;
  const partCount3 = shownOpener?.n === 3;
  const partSize = shownGeo?.size ?? 0;
  const partWidth = shownGeo?.captionW ?? partSize;
  const partCounts = spec?.counts(index) ?? [];

  // Three parts side by side: one height for their words, so the Open buttons line up.
  useEffect(() => {
    captionH.current = equalise(partRefs.current, shownOpener?.n === 3 && !rows);
  }, [shownOpener, rows, partWidth, index, short, split]);

  return (
    <div
      ref={stageRef}
      className={styles.stage}
      data-phone={phone ? "true" : undefined}
      data-focus={focused !== null ? "true" : undefined}
      data-entered={entered ? "true" : undefined}
      data-split={isSplit ? split : undefined}
      data-parts={isSplit && shownOpener ? shownOpener.n : undefined}
      data-stacked={isSplit && !partCount3 && shownGeo?.vertical ? "true" : undefined}
      data-rows={isSplit && rows ? "true" : undefined}
      data-compact={isSplit && rows && partSize < COMPACT_ROW ? "true" : undefined}
      data-short={short ? "true" : undefined}
    >
      <h1 className="sr-only">Collection</h1>
      <div ref={hostRef} className={styles.gl} aria-hidden="true" />

      <div className={styles.top} data-shelf-top="">
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

      {/* The open cover: under each part (beside it, in rows) its line, its count and its Open button. */}
      <div className="sr-only" aria-live="polite">
        {splitUp && spec ? spec.label : ""}
      </div>
      {spec && shownOpener
        ? spec.parts.map((p, k) => (
            <div
              key={`${spec.slug}:${p.id}`}
              ref={(el) => {
                partRefs.current[k] = el;
              }}
              className={styles.half}
              data-ui=""
              data-split-ui=""
              {...{ [`data-${spec.slug}-half`]: p.id }}
              data-show={splitUp ? "true" : "false"}
              data-active={part === k ? "true" : undefined}
              style={
                {
                  width: partWidth || undefined,
                  height: rows ? partSize : undefined,
                  "--accent": spec.accent,
                } as CSSProperties
              }
            >
              <p className={styles.halfLine}>{p.line}</p>
              <div className={styles.halfRow}>
                <span className={styles.halfCount}>{partCounts[k]}</span>
                <button
                  ref={(el) => {
                    partButtons.current[k] = el;
                  }}
                  type="button"
                  className={`${styles.pill} ${styles.dark}`}
                  tabIndex={splitUp ? 0 : -1}
                  aria-label={`Open ${COLLECTIONS[shownOpener.index]?.name ?? ""} ${p.name}`}
                  {...{ [`data-${spec.slug}-open`]: p.id }}
                  onClick={() => {
                    openPart(shownOpener.index, k);
                  }}
                  onFocus={(e) => {
                    if (e.currentTarget.matches(":focus-visible")) choosePart(k, false);
                  }}
                >
                  Open
                </button>
              </div>
            </div>
          ))
        : null}
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
          {...{ [`data-${spec?.slug ?? "video"}-back`]: "" }}
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
        <div className={styles.barText} data-shelf-bartext="">
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
          {...{ [`data-${spec?.slug ?? "video"}-back`]: "" }}
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
        data-shelf-index=""
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
