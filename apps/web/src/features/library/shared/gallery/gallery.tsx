"use client";

/**
 * The shared picture grid of the collection rooms.
 *
 *   <Gallery
 *     label="Official art"
 *     items={items}                       // anything with { id, title, img: LibImage }
 *     layout="masonry"                    // or "justified" (a wall of rows)
 *     size={300}                          // narrowest column (masonry) or row height (justified)
 *     onOpen={(item) => lightbox.open(item.id)}
 *     renderCaption={(item) => <span>{item.title}</span>}   // overlay, optional
 *   />
 *
 * Every picture's size is in the data, so the whole layout is known before anything loads
 * (`layout.ts`). Pictures are built a slice at a time, thumbnails load lazily over their average
 * colour, off screen tiles are skipped with `content-visibility`, and each tile fades and rises
 * in when it comes on screen, a little after its neighbours that arrive with it. Only `transform`
 * and `opacity` move. Tiles are buttons: Tab reaches them, the arrow keys move between them,
 * Enter or Space opens one. Pair it with `Lightbox` and `useLightboxParam`.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";

import styles from "./gallery.module.css";
import {
  layoutGrid,
  neighbour,
  nextSlice,
  ratio,
  SLICE,
  staggerDelay,
  type Dir,
  type GalleryLayout,
} from "./layout";
import type { GalleryItem } from "./types";

export interface GalleryProps<T extends GalleryItem> {
  items: readonly T[];
  /** Spoken name of the list, for example "Official art". */
  label: string;
  onOpen: (item: T, index: number) => void;
  layout?: GalleryLayout;
  /** Masonry: the narrowest column. Justified: the wanted row height. Pixels, default 300. */
  size?: number;
  /** Space between tiles in pixels, default 10. */
  gap?: number;
  /** An overlay drawn over the lower edge of a tile when it is hovered or focused. */
  renderCaption?: (item: T, index: number) => ReactNode;
  /** Show the overlay all the time (a wall without hover). Default false. */
  captionAlways?: boolean;
  /** The id of the open picture, marked on its tile. */
  activeId?: string | null;
  /** How many of the first tiles load at once instead of lazily. Default 6. */
  eager?: number;
  className?: string;
}

const REVEAL_MARGIN = "0px 0px -4% 0px";

export function Gallery<T extends GalleryItem>({
  items,
  label,
  onOpen,
  layout = "masonry",
  size = 300,
  gap = 10,
  renderCaption,
  captionAlways = false,
  activeId = null,
  eager = 6,
  className,
}: GalleryProps<T>) {
  const root = useRef<HTMLUListElement>(null);
  const [width, setWidth] = useState(0);
  const [shown, setShown] = useState(SLICE);

  // The grid follows the width of its box.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      setWidth(Math.floor(el.clientWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  // A new set of pictures (a filter changed) starts again: a first slice, and a fresh reveal.
  const signature = useMemo(() => items.map((it) => it.id).join("|"), [items]);
  const [seen, setSeen] = useState(signature);
  const [gen, setGen] = useState(0);
  if (seen !== signature) {
    setSeen(signature);
    setGen((g) => g + 1);
    setShown(SLICE);
  }

  const grid = useMemo(
    () =>
      width > 0
        ? layoutGrid(
            items.map((it) => ratio(it.img.w, it.img.h)),
            { layout, width, gap, size },
          )
        : { boxes: [], height: 0 },
    [items, width, layout, gap, size],
  );

  // The next slice is built when the browser is idle, until every picture has its tile.
  useEffect(() => {
    if (shown >= items.length) return;
    const more = () => {
      setShown((s) => nextSlice(s, items.length));
    };
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(more, { timeout: 400 });
      return () => {
        window.cancelIdleCallback(handle);
      };
    }
    const handle = window.setTimeout(more, 90);
    return () => {
      window.clearTimeout(handle);
    };
  }, [shown, items.length]);

  // The reveal: one observer for all tiles. Tiles that arrive together come in one after another.
  const observer = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const arriving = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top ||
              a.boundingClientRect.left - b.boundingClientRect.left,
          );
        arriving.forEach((e, k) => {
          const el = e.target as HTMLElement;
          el.style.transitionDelay = `${staggerDelay(k)}ms`;
          el.dataset.in = "1";
          io.unobserve(el);
        });
      },
      { rootMargin: REVEAL_MARGIN, threshold: 0.01 },
    );
    observer.current = io;
    // Tiles that mounted before the observer existed.
    root.current?.querySelectorAll<HTMLElement>("[data-reveal]:not([data-in])").forEach((el) => {
      io.observe(el);
    });
    return () => {
      io.disconnect();
      observer.current = null;
    };
  }, []);

  const reveal = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    if (el.dataset.in) return;
    if (observer.current) observer.current.observe(el);
  }, []);

  const focusTile = useCallback((index: number) => {
    const find = () => root.current?.querySelector<HTMLElement>(`[data-tile="${index}"]`) ?? null;
    const el = find();
    if (el) {
      el.focus();
      return;
    }
    // The tile is not built yet: build up to it, then focus.
    setShown((s) => Math.max(s, index + 1));
    requestAnimationFrame(() => {
      find()?.focus();
    });
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const dir: Dir | null =
      e.key === "ArrowLeft"
        ? "left"
        : e.key === "ArrowRight"
          ? "right"
          : e.key === "ArrowUp"
            ? "up"
            : e.key === "ArrowDown"
              ? "down"
              : null;
    if (!dir || e.altKey || e.ctrlKey || e.metaKey) return;
    const tile = (e.target as HTMLElement).closest<HTMLElement>("[data-tile]");
    if (!tile) return;
    const from = Number(tile.dataset.tile);
    const to = neighbour(grid.boxes, from, dir);
    if (to < 0) return;
    e.preventDefault();
    focusTile(to);
  };

  const count = Math.min(shown, items.length);
  const listStyle: CSSProperties = { height: grid.height, ["--gap" as string]: `${gap}px` };

  return (
    <ul
      ref={root}
      aria-label={label}
      className={`${styles.grid} ${className ?? ""}`}
      style={listStyle}
      onKeyDown={onKeyDown}
      data-ready={width > 0}
    >
      {items.slice(0, count).map((item, index) => {
        const box = grid.boxes[index];
        if (!box) return null;
        const lazy = index >= eager;
        return (
          <li
            key={`${gen}:${item.id}`}
            className={styles.cell}
            style={{
              width: box.w,
              height: box.h,
              transform: `translate3d(${box.x}px, ${box.y}px, 0)`,
            }}
          >
            <div ref={reveal} className={styles.reveal} data-reveal>
              <button
                type="button"
                className={styles.tile}
                data-tile={index}
                data-active={item.id === activeId ? "true" : undefined}
                data-always={captionAlways ? "true" : undefined}
                style={{ backgroundColor: item.img.c }}
                aria-label={item.alt ?? item.title}
                onClick={() => {
                  audio.blip("click");
                  onOpen(item, index);
                }}
              >
                {/* Plain <img>: static export, and the library lives on another origin. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.picture}
                  src={libUrl(item.img.t)}
                  alt=""
                  width={box.w}
                  height={box.h}
                  loading={lazy ? "lazy" : "eager"}
                  decoding="async"
                  draggable={false}
                />
                {renderCaption ? (
                  <span className={styles.caption}>{renderCaption(item, index)}</span>
                ) : null}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
