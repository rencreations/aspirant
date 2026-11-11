"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";

import { useLenis } from "@/components/smooth-scroll";
import { useIsoLayoutEffect } from "@/lib/hooks";
import { libUrl } from "@/lib/library";

import { useQueryState } from "../../use-query-state";
import { findZoomTile, useZoomActions, useZoomTile } from "../core/zoom";
import { placeLabel } from "./facets";
import {
  anchorAt,
  metricsFor,
  pickSize,
  planComic,
  scrollForTile,
  visibleIndexes,
  yOfAnchor,
  type ComicPlan,
  type ComicTile,
} from "./layout";
import styles from "./comic.module.css";
import type { ComicItem } from "./types";
import { noteShown, wasShown, watchNear } from "./watch";

/** A tile asks for its thumbnail within this much of the screen, and for its sharp picture within the nearer margin. */
const FAR = "400% 0px 400% 0px";
const NEAR = "150% 0px 150% 0px";

type Level = 0 | 1 | 2;

/** The width of the box the panels stand in. It is measured when the window rests, so a drag of the edge does not plan again and again. */
function useBoxWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useIsoLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    let timer = 0;
    const measure = () => {
      const w = Math.floor(box.clientWidth);
      if (w > 0) setWidth((prev) => (prev === w ? prev : w));
    };
    measure();
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, 120);
    };
    const observer = new ResizeObserver(later);
    observer.observe(box);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [ref]);
  return width;
}

/** One picture over the tile: it fades in once it has decoded, and at once when it has shown before. */
function Layer({ src, onDone }: { src: string; onDone?: (() => void) | undefined }) {
  const ref = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);
  const [instant] = useState(() => wasShown(src));
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    el.decode().then(
      () => {
        if (!alive) return;
        noteShown(src);
        setReady(true);
        onDone?.();
      },
      () => {
        // A picture that cannot be read leaves its colour; the room does not wait for it.
        if (alive) onDone?.();
      },
    );
    return () => {
      alive = false;
    };
  }, [src, onDone]);
  return (
    // Plain <img>: static export, and the library lives on another origin.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      className={styles.pic}
      src={src}
      alt=""
      decoding="async"
      draggable={false}
      data-ready={ready || undefined}
      data-instant={instant || undefined}
    />
  );
}

interface TileProps {
  item: ComicItem;
  tile: ComicTile;
  dpr: number;
  onSettled: (id: string) => void;
}

/** One panel. Empty until it is within a screen or two, then its thumbnail, then its sharp picture. */
const Tile = memo(function Tile({ item, tile, dpr, onSettled }: TileProps) {
  const cell = useRef<HTMLLIElement>(null);
  const slide = useRef<HTMLSpanElement>(null);
  const zoom = useZoomTile(item.id, "light");
  const { open } = useZoomActions();
  const [level, setLevel] = useState<Level>(0);

  useEffect(() => {
    const el = cell.current;
    if (!el) return;
    let far = false;
    let near = false;
    const sync = () => {
      setLevel(near ? 2 : far ? 1 : 0);
    };
    const offFar = watchNear(el, FAR, (inside) => {
      far = inside;
      sync();
    });
    const offNear = watchNear(el, NEAR, (inside) => {
      near = inside;
      sync();
    });
    return () => {
      offFar();
      offNear();
    };
  }, []);

  const settled = useCallback(() => {
    onSettled(item.id);
  }, [onSettled, item.id]);

  const { className, onClick, ...zoomRest } = zoom;
  const panning = tile.pan > 0;
  const across = panning ? tile.pan : tile.w;
  const sharp = libUrl(item.img[pickSize(across, dpr, item.img.w)]);
  const layers = (
    <>
      {level >= 1 ? <Layer key="t" src={libUrl(item.img.t)} /> : null}
      {level >= 2 ? <Layer key="p" src={sharp} onDone={settled} /> : null}
    </>
  );

  // A strip that slides opens the viewer on the part of it that shows now.
  const press = (event: MouseEvent<HTMLElement>) => {
    const strip = slide.current;
    if (!panning || !strip || strip.scrollWidth <= 0) {
      onClick(event);
      return;
    }
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const x = Math.min(1, strip.scrollLeft / strip.scrollWidth);
    const w = Math.min(1, strip.clientWidth / strip.scrollWidth);
    open(item.id, event.currentTarget, { frame: { x: Math.min(x, 1 - w), y: 0, w, h: 1 } });
  };

  const style: CSSProperties = {
    left: tile.x,
    top: tile.y,
    width: tile.w,
    height: tile.h,
  };
  const tint = { "--c": item.img.c } as CSSProperties;

  return (
    <li ref={cell} className={styles.cell} style={style}>
      <button
        type="button"
        {...zoomRest}
        className={`${className} ${styles.tile}`}
        style={tint}
        onClick={press}
        aria-label={`${placeLabel(item)}. ${item.alt}`}
        data-comic-tile=""
        data-id={item.id}
        data-shape={item.shape}
        data-alpha={item.alpha || undefined}
        data-span={tile.span || undefined}
        data-pan={panning || undefined}
        data-level={level}
      >
        {panning ? (
          <span ref={slide} className={styles.slide}>
            <span className={styles.inner} style={{ width: tile.pan }}>
              {layers}
            </span>
          </span>
        ) : (
          layers
        )}
      </button>
    </li>
  );
});

interface FieldProps {
  /** The panels to show, in reading order. */
  items: readonly ComicItem[];
  /** Called once the panels on the first screen have drawn (at once when there is none). */
  onStanding: () => void;
}

/** How long the page keeps its place after the viewer has gone back in the history, and what ends it early. */
const HOLD_MS = 800;
const USER_MOVES = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

/** What stands over the top of the screen: the bar and the back button. */
const BAR = 96;

/**
 * The panels. It plans the lanes from the width of its box (the plan is made again when the width
 * changes, and the panel in the middle of the screen stays there) and keeps every tile in the page,
 * so the viewer can always find the tile to grow from and land on. A tile loads its pictures when
 * it is near (`watch.ts`).
 */
function ComicFieldInner({ items, onStanding }: FieldProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const width = useBoxWidth(boxRef);
  const { getLenis } = useLenis();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;

  const shapes = useMemo(() => items.map((item) => ({ w: item.img.w, h: item.img.h })), [items]);
  const groups = useMemo(() => items.map((item) => item.comic), [items]);
  const plan = useMemo<ComicPlan | null>(
    () => (width > 0 ? planComic(shapes, metricsFor(width, window.innerHeight), groups) : null),
    [shapes, groups, width],
  );
  const indexById = useMemo(() => new Map(items.map((item, i) => [item.id, i])), [items]);

  // The scroll as the page last had it, for keeping the place when the plan changes. A scroll the
  // room makes is noted at once, before the page has sent its event.
  const lastY = useRef(0);
  const scrollTo = useCallback(
    (y: number) => {
      lastY.current = y;
      const lenis = getLenis();
      if (lenis) {
        // Lenis clamps to the page height it measured last, and the page has just grown.
        lenis.resize();
        lenis.scrollTo(y, { immediate: true, force: true });
      } else window.scrollTo(0, y);
    },
    [getLenis],
  );
  const boxTop = () => (boxRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
  const maxScroll = () =>
    Math.max(0, document.documentElement.scrollHeight - document.documentElement.clientHeight);

  useEffect(() => {
    const note = () => {
      lastY.current = window.scrollY;
    };
    note();
    const lenis = getLenis();
    const off = lenis?.on("scroll", note);
    window.addEventListener("scroll", note, { passive: true });
    return () => {
      off?.();
      window.removeEventListener("scroll", note);
    };
  }, [getLenis]);

  // The viewer adds a history entry when a picture opens and goes back one entry when it closes, and
  // the browser puts the page back where that entry left it (GSAP resets `scrollRestoration` to
  // "auto" on every refresh, so it cannot be turned off for good). The page behind has followed the
  // viewer since (the arrow keys, a deep link), so the place it had is put back.
  useEffect(() => {
    let frame = 0;
    let release = () => undefined;
    const hold = () => {
      // The browser may put the page back a little after this event, so the place is asserted for a
      // moment, until the visitor does something that moves the page themselves.
      release();
      const y = lastY.current;
      const until = performance.now() + HOLD_MS;
      const fix = () => {
        if (Math.abs(window.scrollY - y) > 1) scrollTo(y);
        if (performance.now() < until) frame = requestAnimationFrame(fix);
      };
      release = () => {
        cancelAnimationFrame(frame);
        for (const type of USER_MOVES) window.removeEventListener(type, release);
        release = () => undefined;
      };
      for (const type of USER_MOVES) window.addEventListener(type, release, { passive: true });
      fix();
    };
    window.addEventListener("popstate", hold);
    return () => {
      release();
      window.removeEventListener("popstate", hold);
    };
  }, [scrollTo]);

  // A new width plans the lanes again: the panel in the middle of the screen stays in the middle.
  const before = useRef<{ plan: ComicPlan; items: readonly ComicItem[]; top: number } | null>(null);
  useIsoLayoutEffect(() => {
    if (!plan) return;
    const was = before.current;
    const top = boxTop();
    before.current = { plan, items, top };
    if (was?.items !== items || was.plan.metrics.width === plan.metrics.width) return;
    const vh = window.innerHeight;
    const anchor = anchorAt(was.plan, lastY.current + vh / 2 - was.top);
    const y = anchor ? yOfAnchor(plan, anchor) : null;
    if (y === null) return;
    const target = Math.min(Math.max(0, top + y - vh / 2), maxScroll());
    if (Math.abs(target - window.scrollY) > 1) scrollTo(target);
  }, [plan, items]);

  // A picture named by the address (a deep link, the library search, the arrow keys in the viewer)
  // is brought into view, so its tile is there for the viewer to land on.
  const [wanted] = useQueryState("i");
  useEffect(() => {
    if (!wanted || !plan) return;
    const index = indexById.get(wanted);
    const tile = index === undefined ? undefined : plan.tiles[index];
    if (!tile) return;
    const el = findZoomTile(wanted);
    if (el) {
      // It stays where it is when a good part of it shows under the bar: a tile with only its edge
      // on the screen is not a place the viewer can land on well.
      const r = el.getBoundingClientRect();
      const shown = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, BAR);
      if (shown >= Math.min(r.height * 0.6, 320)) return;
    }
    scrollTo(scrollForTile(tile, boxTop(), window.innerHeight, BAR, maxScroll()));
    // `scrollTo` and the box are read when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, plan, indexById]);

  // The curtain waits for the pictures of the first screen: the tiles that show when the plan first
  // stands (after a deep link has scrolled to its picture).
  const pending = useRef<Set<string> | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (!plan || started.current) return;
    started.current = true;
    const shown = visibleIndexes(plan, boxTop(), window.scrollY, window.innerHeight, 0)
      .map((i) => items[i]?.id)
      .filter((id): id is string => id !== undefined);
    if (shown.length === 0) {
      onStanding();
      return;
    }
    pending.current = new Set(shown);
    // Read once, when the plan first stands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);
  const settle = useCallback(
    (id: string) => {
      const wait = pending.current;
      if (!wait) return;
      wait.delete(id);
      if (wait.size === 0) {
        pending.current = null;
        onStanding();
      }
    },
    [onStanding],
  );

  return (
    <div className={styles.stage}>
      <div ref={boxRef} className={styles.box}>
        {plan ? (
          <ol
            className={styles.field}
            style={{ height: plan.height }}
            aria-label="Panels in reading order"
            data-comic-field=""
            data-lanes={plan.metrics.lanes}
            data-height={plan.height}
          >
            {plan.tiles.map((tile) => {
              const item = items[tile.index];
              return item ? (
                <Tile key={item.id} item={item} tile={tile} dpr={dpr} onSettled={settle} />
              ) : null;
            })}
          </ol>
        ) : null}
      </div>
    </div>
  );
}

export const ComicField = memo(ComicFieldInner);
