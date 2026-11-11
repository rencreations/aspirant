"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MutableRefObject,
} from "react";

import { useIsoLayoutEffect } from "@/lib/hooks";
import { expectReady } from "@/lib/page-ready";
import { cancelDeferred } from "@/lib/preload";
import { libUrl } from "@/lib/library";

import { CanonBadge } from "../../shell/credit";
import { recheckZoomCursor, useZoom, useZoomActions } from "../core/zoom";
import { CaptionWave } from "./caption";
import { Chrome } from "./chrome";
import { whenCurtainOpen } from "./curtain";
import type { SplashItem } from "./data";
import { SplashMotion } from "./engine";
import {
  captionLines,
  hrefOf,
  isMade,
  metaLine,
  NOT_OFFICIAL_SHORT,
  rowCells,
  spoken,
  toneOf,
} from "./labels";
import {
  ENTRANCE_MS,
  ENTRANCE_RISE,
  REACH,
  ROW_REACH,
  activeOf,
  innerY,
  keyAction,
  nearIndexes,
  offsetOf,
  rowOpacity,
  visibleFrame,
  windowY,
  type Layout,
} from "./model";
import { firstPlaces, startIndex } from "./places";
import {
  GROUP,
  loadPicture,
  pictureState,
  releasePictures,
  subscribePicture,
  type PictureState,
} from "./pictures";
import styles from "./splash.module.css";

export interface StageView {
  layout: Layout;
  /** The size the windows draw. */
  size: "p" | "f";
  /** The screen has been read. Until then the windows draw no picture (the server's guess could be the wrong size). */
  measured: boolean;
}

/** What the room can ask of the stage. */
export interface StageApi {
  /** Stand on picture `index` at once (the zoom stepped to it, or the search opened it). */
  jumpTo: (index: number) => void;
}

interface Props {
  items: readonly SplashItem[];
  view: StageView;
  apiRef: MutableRefObject<StageApi | null>;
}

type Part = "wins" | "panes" | "rows";
type Register = (part: Part, k: number, el: HTMLElement | null) => void;

const SERVER_PICTURE: PictureState = { state: "idle", fraction: 0 };

function usePicture(url: string): PictureState {
  const subscribe = useCallback((cb: () => void) => subscribePicture(url, cb), [url]);
  return useSyncExternalStore(
    subscribe,
    () => pictureState(url),
    () => SERVER_PICTURE,
  );
}

/** Where the picture stands in its pane: the pane shows `frame`, so the whole picture is `1 / frame` of it. */
function placement(frame: SplashItem["frame"]): CSSProperties {
  return {
    width: `${(100 / frame.w).toFixed(4)}%`,
    height: `${(100 / frame.h).toFixed(4)}%`,
    left: `${((-100 * frame.x) / frame.w).toFixed(4)}%`,
    top: `${((-100 * frame.y) / frame.h).toFixed(4)}%`,
  };
}

/**
 * The picture in a window: its colour until it has arrived (`img.c` on the pane), then the picture
 * itself, mounted only once it is downloaded and decoded, so a step never shows a half drawn or a
 * stale picture. A picture that arrives late fades in. While it is on its way the front window says
 * so, with the real share of the bytes.
 */
const Pic = memo(function Pic({ url, frame }: { url: string; frame: SplashItem["frame"] }) {
  const snap = usePicture(url);
  // A picture that was not there when the window mounted fades in when it arrives.
  const [late] = useState(snap.state !== "done");
  useEffect(() => {
    void loadPicture(url);
  }, [url]);
  if (snap.state === "done") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={styles.pic}
        data-late={late ? "true" : undefined}
        src={url}
        alt=""
        decoding="async"
        draggable={false}
        style={placement(frame)}
      />
    );
  }
  const pct = Math.round(snap.fraction * 100);
  return (
    <span
      className={styles.loading}
      data-state={snap.state}
      role={snap.state === "gone" ? "status" : undefined}
      aria-hidden={snap.state === "gone" ? undefined : true}
    >
      {snap.state === "gone" ? (
        "This picture is not available."
      ) : (
        <>
          <span className={styles.loadText}>{pct > 0 ? `Loading ${pct}%` : "Loading"}</span>
          <span className={styles.loadTrack}>
            <i className={styles.loadLine} />
          </span>
        </>
      )}
    </span>
  );
});

interface WinProps {
  item: SplashItem;
  k: number;
  current: boolean;
  /** The stage has landed: the picture in front takes a press, and the cursor says Zoom in over it. */
  live: boolean;
  /** The picture's address, or null until the screen has been read. */
  url: string | null;
  register: Register;
}

/** One window: a box of the window's size that clips, and the pane (bigger) that moves inside it. */
const Win = memo(function Win({ item, k, current, live, url, register }: WinProps) {
  const winRef = useCallback((el: HTMLElement | null) => register("wins", k, el), [register, k]);
  const paneRef = useCallback((el: HTMLElement | null) => register("panes", k, el), [register, k]);
  return (
    <div
      ref={winRef}
      className={styles.win}
      data-win={k}
      data-zoom-id={item.id}
      data-zoom={current && live ? "in" : undefined}
      // Not in the tab order, but the zoom gives the focus back to the window it grew from.
      tabIndex={-1}
      role={current ? "img" : undefined}
      aria-label={current ? item.alt : undefined}
      aria-hidden={current ? undefined : true}
    >
      <div
        ref={paneRef}
        className={styles.pane}
        data-tone={toneOf(item.img.c)}
        style={{ backgroundColor: item.img.c }}
      >
        {url ? <Pic url={url} frame={item.frame} /> : null}
      </div>
    </div>
  );
});

interface RowProps {
  item: SplashItem;
  k: number;
  current: boolean;
  live: boolean;
  register: Register;
}

/** One row of the title list, a real link to the picture (`?i=<id>`) in the page's HTML. */
const Row = memo(function Row({ item, k, current, live, register }: RowProps) {
  const ref = useCallback((el: HTMLElement | null) => register("rows", k, el), [register, k]);
  const c = rowCells(item, k);
  return (
    <li ref={ref} className={styles.row} data-row={k} data-current={current ? "true" : undefined}>
      <a
        className={styles.rowLink}
        href={hrefOf(item.id)}
        data-row-link={k}
        data-zoom={current && live ? "in" : undefined}
        aria-current={current ? "true" : undefined}
        // The arrow keys move the stage, so the Tab key visits only the row in front.
        tabIndex={current ? 0 : -1}
      >
        <i className={styles.tri} aria-hidden="true" />
        <span className={styles.left}>
          <span className={styles.no} data-cell="no">
            {c.no}
          </span>
          <span className={styles.rt} data-cell="title">
            {c.title}
          </span>
        </span>
        <span className={styles.right}>
          <span className={styles.rc} data-cell="chars">
            {c.chars}
          </span>
          <span className={styles.rw} data-cell="who">
            {c.who}
          </span>
          <span className={styles.ry} data-cell="year">
            {c.year}
          </span>
        </span>
      </a>
    </li>
  );
});

/** The three lines of a caption: the people, the skin or moment, and the kind of picture. */
function textOf(item: SplashItem): string[] {
  const [a, b] = captionLines(item.title);
  return [a, b, metaLine(item)];
}

/** The line the probes and the unmount check read. */
interface StageProbe {
  snapshot: () => { pos: number; target: number; running: boolean; active: number };
  /** Draw the stage at `pos` without moving it (for frame sheets), or back where it is (null). */
  peek: (pos: number | null) => void;
  /** The time the draw of the last frames took, in ms. */
  frames: () => { count: number; mean: number; max: number };
}

declare global {
  interface Window {
    __splashStage?: StageProbe;
  }
}

const EASE_OUT = "cubic-bezier(0.215, 0.61, 0.355, 1)";

const frames = (n: number) =>
  new Promise<void>((resolve) => {
    const tick = (left: number) => {
      if (left <= 0) resolve();
      else requestAnimationFrame(() => tick(left - 1));
    };
    tick(n);
  });

/**
 * The stage: the windows, the title list and the caption. One fixed screen with its own wheel,
 * keys and touch. The windows move by `transform` only, from one place value that a frame loop
 * eases after the target (`engine.ts`), and the loop stops at rest.
 */
export function SplashStage({ items, view, apiRef }: Props) {
  const n = items.length;
  const { open } = useZoomActions();
  const { openId } = useZoom();
  const [active, setActive] = useState(0);
  const [stage, setStage] = useState<"hold" | "rise" | "rest">("hold");
  // The engine has read the address and stands on its first picture: before that the windows of
  // the first picture of the list would ask for files that a deep link does not want.
  const [booted, setBooted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  const line1 = useRef<HTMLSpanElement>(null);
  const line2 = useRef<HTMLSpanElement>(null);
  const metaRef = useRef<HTMLSpanElement>(null);
  const refs = useRef<Record<Part, Array<HTMLElement | null>>>({ wins: [], panes: [], rows: [] });
  const lit = useRef<Record<"wins" | "rows", Set<number>>>({ wins: new Set(), rows: new Set() });
  const motion = useRef<SplashMotion | null>(null);
  const viewRef = useRef(view);
  const stageRef = useRef(stage);
  const itemsRef = useRef(items);
  const act = useRef<{ open: () => void } | null>(null);

  useIsoLayoutEffect(() => {
    viewRef.current = view;
    stageRef.current = stage;
    itemsRef.current = items;
  });

  const register = useCallback<Register>((part, k, el) => {
    refs.current[part][k] = el;
    // A window that mounts again is drawn again: forget that it was lit.
    if (part !== "panes") lit.current[part].delete(k);
  }, []);

  const near = useMemo(() => nearIndexes(active, n), [active, n]);
  const urls = useMemo(() => items.map((item) => libUrl(item.img[view.size])), [items, view.size]);

  // The pictures near the one in front are asked for (the registry joins a download that runs).
  useEffect(() => {
    if (!view.measured || !booted) return;
    for (const k of near) {
      const url = urls[k];
      if (url) void loadPicture(url);
    }
  }, [near, urls, view.measured, booted]);

  // Windows that mount are drawn at once, before the browser paints them.
  useIsoLayoutEffect(() => {
    motion.current?.redraw();
  }, [near, view]);

  // The zoom reads what is under the pointer one frame after it has closed, which can be a frame
  // before the viewer has left the page, and the cursor would go on saying Zoom out over a window
  // that now zooms in. Look again once the viewer has gone.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (openId) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    let raf = 0;
    let tries = 0;
    const look = () => {
      tries += 1;
      if (document.querySelector("[data-zoom-viewer]") && tries < 120) {
        raf = requestAnimationFrame(look);
        return;
      }
      recheckZoomCursor();
    };
    raf = requestAnimationFrame(look);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [openId]);

  // The one big effect: the engine, the caption, the input, the entrance.
  useEffect(() => {
    const root = rootRef.current;
    const layers = layersRef.current;
    const cap = capRef.current;
    const l1 = line1.current;
    const l2 = line2.current;
    const lm = metaRef.current;
    if (!root || !layers || !cap || !l1 || !l2 || !lm || n === 0) return;
    let alive = true;
    const litNow = lit.current;
    const mark = expectReady("library-arts-splash-stage");
    const list = itemsRef.current;
    const start = startIndex(window.location.search, list);
    const caption = new CaptionWave([l1, l2, lm], cap);
    const stats = { count: 0, total: 0, max: 0 };
    let entrance: Animation | null = null;
    let curtain: ReturnType<typeof whenCurtainOpen> | null = null;
    let suppressClick = 0;

    const dialogOpen = () => document.querySelector("[role='dialog']") !== null;
    const textFor = (k: number) => {
      const item = list[k];
      return { lines: item ? textOf(item) : [] };
    };

    const frame = (pos: number) => {
      const t0 = performance.now();
      const { layout } = viewRef.current;
      const r = refs.current;
      for (let k = 0; k < n; k += 1) {
        const d = offsetOf(k, pos, n);
        const win = r.wins[k];
        if (win) {
          if (Math.abs(d) < REACH) {
            if (!lit.current.wins.has(k)) {
              lit.current.wins.add(k);
              win.dataset.on = "true";
            }
            win.style.transform = `translate3d(0, ${windowY(d, layout).toFixed(2)}px, 0)`;
            const pane = r.panes[k];
            if (pane) pane.style.transform = `translate3d(0, ${innerY(d, layout).toFixed(2)}px, 0)`;
          } else if (lit.current.wins.delete(k)) {
            delete win.dataset.on;
          }
        }
        const row = r.rows[k];
        if (row && layout.list) {
          const near = Math.abs(d) < ROW_REACH;
          if (near) {
            if (!lit.current.rows.has(k)) {
              lit.current.rows.add(k);
              row.dataset.on = "true";
            }
            row.style.transform = `translate3d(0, ${(d * layout.row).toFixed(2)}px, 0)`;
            row.style.opacity = rowOpacity(d).toFixed(2);
          } else if (lit.current.rows.delete(k)) {
            delete row.dataset.on;
          }
        }
      }
      const took = performance.now() - t0;
      stats.count += 1;
      stats.total += took;
      if (took > stats.max) stats.max = took;
    };

    // When the visitor rests on a picture for a moment, its full size is fetched quietly, so the
    // zoom that may follow ends sharp. A window that draws the full size already has it.
    const warmed = new Set<number>();
    let warmTimer = 0;
    const warmFull = () => {
      const k = m.restingIndex();
      const item = list[k];
      if (!item || warmed.has(k) || viewRef.current.size === "f" || item.img.f === item.img.p) {
        return;
      }
      warmed.add(k);
      const img = new Image();
      img.fetchPriority = "low";
      img.decoding = "async";
      img.src = libUrl(item.img.f);
    };

    const m = new SplashMotion(n, start, {
      frame,
      active: (index, instant) => {
        setActive(index);
        if (stageRef.current === "hold" || m.entering) return;
        caption.show(textFor(index), instant);
      },
      rest: () => {
        // The window under a resting pointer changed: the cursor looks again.
        requestAnimationFrame(recheckZoomCursor);
        window.clearTimeout(warmTimer);
        warmTimer = window.setTimeout(warmFull, 900);
      },
      landed: () => {
        caption.show(textFor(m.restingIndex()));
        requestAnimationFrame(recheckZoomCursor);
      },
    });
    motion.current = m;
    apiRef.current = {
      jumpTo: (index) => {
        if (index < 0 || index >= n || index === m.restingIndex()) return;
        m.jumpTo(index);
      },
    };
    m.begin();
    setBooted(true);

    window.__splashStage = {
      snapshot: () => ({ ...m.snapshot(), active: activeOf(m.snapshot().pos, n) }),
      peek: (pos) => {
        m.peek(pos);
      },
      frames: () => ({
        count: stats.count,
        mean: stats.count > 0 ? stats.total / stats.count : 0,
        max: stats.max,
      }),
    };

    // The press on the picture in front (or its row, or its caption) opens the zoom from the window.
    const openFront = () => {
      if (m.entering) return;
      const { pos } = m.snapshot();
      const k = activeOf(pos, n);
      const el = refs.current.wins[k];
      const item = list[k];
      if (!el || !item) return;
      const { layout } = viewRef.current;
      open(item.id, el, {
        frame: visibleFrame(item.frame, layout, innerY(offsetOf(k, pos, n), layout)),
      });
    };
    act.current = {
      open: () => {
        if (!dialogOpen()) openFront();
      },
    };

    const ready = () => stageRef.current !== "hold";

    // Input -----------------------------------------------------------------------------------
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || dialogOpen()) return;
      e.preventDefault();
      if (!ready() || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      m.wheel(e.deltaY, e.deltaMode, e.timeStamp, root.clientHeight);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || dialogOpen()) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const action = keyAction(e.key, e.shiftKey);
      if (action === null || !ready()) return;
      // A link or a button keeps Space and Enter for itself.
      if ((e.key === " " || e.key === "Enter") && target?.closest("a[href], button")) return;
      e.preventDefault();
      if (action === "open") openFront();
      else if (action === "first") m.goTo(0);
      else if (action === "last") m.goTo(n - 1);
      else m.step(action);
    };

    // A finger drags the stage up to one place and lets go; a tap is a click, handled below.
    let captured = -1;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !e.isPrimary || !ready() || dialogOpen()) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("a[href], button, [data-foot]")) return;
      m.touchDown(e.pointerId, e.clientY);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if (m.touchMove(e.pointerId, e.clientY) && captured !== e.pointerId) {
        captured = e.pointerId;
        try {
          root.setPointerCapture(e.pointerId);
        } catch {
          // The pointer is already gone: the drag ends with its `pointerup`.
        }
      }
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      captured = -1;
      // A drag is never a tap: the click that may follow it is dropped.
      if (m.touchUp(e.pointerId, e.clientY) === "drag") suppressClick = performance.now() + 450;
    };
    const onCancel = (e: PointerEvent) => {
      captured = -1;
      m.touchCancel(e.pointerId);
    };

    // A press (mouse, tap or Enter on a link): the picture in front opens; another goes to the front.
    const onClick = (e: MouseEvent) => {
      if (performance.now() < suppressClick || dialogOpen() || !ready() || m.entering) return;
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      const link = target.closest<HTMLAnchorElement>("a[data-row-link]");
      if (link) {
        // A new tab keeps the plain link.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        const k = Number(link.dataset.rowLink);
        if (k === activeOf(m.snapshot().pos, n)) openFront();
        else m.goTo(k);
        return;
      }
      if (target.closest("a[href], button")) return;
      const win = target.closest<HTMLElement>("[data-win]");
      if (win) {
        const k = Number(win.dataset.win);
        if (k === activeOf(m.snapshot().pos, n)) openFront();
        else m.goTo(k);
        return;
      }
      if (target.closest("[data-cap]")) openFront();
    };

    const onResize = () => {
      m.redraw();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize, { passive: true });
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    root.addEventListener("click", onClick);

    // The entrance ----------------------------------------------------------------------------
    void (async () => {
      // The screen is read in the room's layout effect: one frame on, the size is the right one.
      await frames(1);
      if (!alive) return;
      // The pictures of the first screen: the one before, the one in front and three after it.
      const size = viewRef.current.size;
      const first = firstPlaces(start, n)
        .map((k) => list[k])
        .filter((item): item is SplashItem => !!item)
        .map((item) => libUrl(item.img[size]));
      await Promise.all(first.map((u) => loadPicture(u)));
      if (!alive) return;
      // Windows drawn and painted behind the hold, then the curtain may open.
      await frames(2);
      if (!alive) return;
      mark();
      curtain = whenCurtainOpen();
      await curtain.promise;
      if (!alive) return;
      const direct = new URLSearchParams(window.location.search).has("i") || dialogOpen();
      if (direct) {
        // Opened on a picture (a deep link, the search): the stage is already in place, no sweep.
        setStage("rest");
        caption.show(textFor(m.restingIndex()), true);
        requestAnimationFrame(recheckZoomCursor);
        return;
      }
      entrance = layers.animate(
        [
          { transform: `translate3d(0, ${ENTRANCE_RISE}px, 0)`, opacity: 0 },
          { transform: "translate3d(0, 0, 0)", opacity: 1 },
        ],
        { duration: ENTRANCE_MS, easing: EASE_OUT, fill: "both" },
      );
      setStage("rise");
      m.enter();
      void entrance.finished.then(
        () => {
          if (!alive) return;
          setStage("rest");
          entrance?.cancel();
          entrance = null;
        },
        () => undefined,
      );
    })();

    return () => {
      alive = false;
      window.clearTimeout(warmTimer);
      mark();
      curtain?.cancel();
      entrance?.cancel();
      caption.destroy();
      m.destroy();
      motion.current = null;
      apiRef.current = null;
      act.current = null;
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      root.removeEventListener("click", onClick);
      delete window.__splashStage;
      litNow.wins.clear();
      litNow.rows.clear();
      cancelDeferred(GROUP);
      releasePictures();
    };
    // The stage lives as long as the room: the layout and the size are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, n]);

  // Only once the entrance has landed: before that nothing on the stage takes a press, and the
  // cursor does not say Zoom in over a stage that is still hidden or gliding.
  const live = stage === "rest";
  useEffect(() => {
    if (live) requestAnimationFrame(recheckZoomCursor);
  }, [live]);

  const { layout } = view;
  const roomStyle = useMemo(
    () =>
      ({
        "--ww": `${layout.ww}px`,
        "--wh": `${layout.wh}px`,
        "--pw": `${layout.pw}px`,
        "--ph": `${layout.ph}px`,
        "--padx": `${layout.padX}px`,
        "--pady": `${layout.padY}px`,
        "--row": `${layout.row}px`,
      }) as CSSProperties,
    [layout],
  );
  const front = items[active] ?? items[0];
  const made = front ? isMade(front) : false;

  return (
    <div
      ref={rootRef}
      className={styles.room}
      data-theme="daybreak"
      data-mode={view.layout.mode}
      data-stage={stage}
      data-zoom-open={openId ? "true" : undefined}
      data-lenis-prevent
      style={roomStyle}
      role="region"
      aria-roledescription="carousel"
      aria-label="Splash art"
    >
      <div ref={layersRef} className={styles.layers} data-stage={stage}>
        <nav className={styles.list} aria-label="All splash art">
          <ol className={styles.rows}>
            {items.map((item, k) => (
              <Row
                key={item.id}
                item={item}
                k={k}
                current={k === active}
                live={live}
                register={register}
              />
            ))}
          </ol>
        </nav>
        <div className={styles.wins}>
          {near.map((k) => {
            const item = items[k];
            return item ? (
              <Win
                key={item.id}
                item={item}
                k={k}
                current={k === active}
                live={live}
                url={view.measured && booted ? (urls[k] ?? null) : null}
                register={register}
              />
            ) : null;
          })}
        </div>
      </div>
      <div className={styles.fadeTop} aria-hidden="true" />
      <div className={styles.fadeBottom} aria-hidden="true" />

      <div className={styles.caption} data-made={made ? "true" : undefined}>
        <div
          ref={capRef}
          className={styles.capBody}
          data-cap=""
          data-zoom={live ? "in" : undefined}
          role="group"
          aria-label={front?.title}
        >
          <p className={styles.title} aria-hidden="true">
            <span ref={line1} className={styles.line} />
            <span ref={line2} className={styles.line} />
          </p>
          <p className={styles.meta} aria-hidden="true">
            <span ref={metaRef} className={styles.line} />
          </p>
        </div>
        <p className={styles.mark} hidden={!made}>
          {front ? <CanonBadge canon={front.canon} /> : null}
          <span>{NOT_OFFICIAL_SHORT}</span>
        </p>
        <button
          type="button"
          className={styles.zoomButton}
          onClick={() => {
            act.current?.open();
          }}
        >
          <i aria-hidden="true" />
          Zoom in
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {front ? spoken(front, active, n) : ""}
      </p>
      <Chrome />
    </div>
  );
}
