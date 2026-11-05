"use client";

/**
 * The fan art wall. Every picture has one tile for the whole visit, placed with a translate. When a
 * filter changes the tiles that stay slide to their new places, the ones that leave fade and shrink
 * where they were, and the ones that arrive fade in. Only `transform` and `opacity` move. The
 * positions come from the shared grid maths (`shared/gallery/layout.ts`).
 */
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";
import { CHARACTER_NAMES } from "@/lib/slugs";

import { layoutGrid, neighbour, ratio, type Box, type Dir } from "../shared/gallery/layout";
import { canonLabel, creditText } from "./model";
import type { FanPicture } from "./types";
import styles from "./wall.module.css";

interface WallProps {
  /** Every picture of the room, in one fixed order. The DOM keeps this order. */
  all: readonly FanPicture[];
  /** The ids that pass the filters, in the order the viewer walks through them. */
  shown: readonly FanPicture[];
  label: string;
  activeId: string | null;
  onOpen: (id: string) => void;
}

const GAP = 12;
const SIZE = 300;
const FIRST = 8;

export function Wall({ all, shown, label, activeId, onOpen }: WallProps) {
  const root = useRef<HTMLUListElement>(null);
  const [width, setWidth] = useState(0);
  // Where each tile last was. A tile that has been on the wall stays in the page, so when it leaves
  // it shrinks in place, and when it comes back it slides from there. A tile that never was is
  // added only when it first shows.
  const [memory, setMemory] = useState<ReadonlyMap<string, Box>>(() => new Map());

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

  const grid = useMemo(
    () =>
      width > 0
        ? layoutGrid(
            shown.map((it) => ratio(it.img.w, it.img.h)),
            { layout: "masonry", width, gap: GAP, size: SIZE },
          )
        : { boxes: [] as Box[], height: 0 },
    [shown, width],
  );

  const index = useMemo(() => new Map(shown.map((it, i) => [it.id, i])), [shown]);

  // Remember where each shown tile is (adjusted during render, so a new tile mounts in its place).
  const [basis, setBasis] = useState<{ shown: readonly FanPicture[]; grid: typeof grid } | null>(
    null,
  );
  if (basis?.shown !== shown || basis.grid !== grid) {
    setBasis({ shown, grid });
    let changed = false;
    const next = new Map(memory);
    shown.forEach((it, i) => {
      const b = grid.boxes[i];
      if (!b) return;
      const p = memory.get(it.id);
      if (p?.x !== b.x || p.y !== b.y || p.w !== b.w || p.h !== b.h) {
        next.set(it.id, b);
        changed = true;
      }
    });
    if (changed) setMemory(next);
  }

  const focusTile = (i: number) => {
    root.current?.querySelector<HTMLElement>(`[data-tile="${i}"]`)?.focus();
  };

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
    const to = neighbour(grid.boxes, Number(tile.dataset.tile), dir);
    if (to < 0) return;
    e.preventDefault();
    focusTile(to);
  };

  return (
    <ul
      ref={root}
      aria-label={label}
      className={styles.wall}
      style={{ height: grid.height }}
      onKeyDown={onKeyDown}
      data-ready={width > 0}
    >
      {width > 0
        ? all.map((it) => {
            const i = index.get(it.id);
            const visible = i !== undefined;
            const box = visible ? grid.boxes[i] : undefined;
            const kept = memory.get(it.id);
            const at = box ?? kept;
            if (!at) return null;
            const eager = visible && i < FIRST;
            const style = {
              width: at.w,
              height: at.h,
              transform: `translate3d(${at.x}px, ${at.y}px, 0)`,
              "--c": it.img.c,
              "--d": `${Math.min(visible ? i : 0, 14) * 36}ms`,
            } as CSSProperties;
            return (
              <li key={it.id} className={styles.cell} style={style} data-visible={visible}>
                <button
                  type="button"
                  className={styles.tile}
                  tabIndex={visible ? 0 : -1}
                  aria-hidden={visible ? undefined : true}
                  data-tile={visible ? i : undefined}
                  data-active={it.id === activeId ? "true" : undefined}
                  aria-label={`${it.title}. ${creditText(it)}`}
                  onClick={() => {
                    audio.blip("click");
                    onOpen(it.id);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className={styles.picture}
                    src={libUrl(it.img.t)}
                    alt=""
                    width={Math.round(at.w)}
                    height={Math.round(at.h)}
                    loading={eager ? "eager" : "lazy"}
                    decoding="async"
                    draggable={false}
                  />
                  <span className={styles.kind} aria-hidden="true">
                    {it.kind === "cosplay" ? "Cosplay" : null}
                  </span>
                  <span className={styles.caption}>
                    <span className={`${styles.capTitle} display`}>{it.title}</span>
                    <span className={styles.capRow}>
                      <span className={styles.capBadge}>{canonLabel(it)}</span>
                      <span className={styles.capCredit}>{creditText(it)}</span>
                    </span>
                    <span className={`${styles.capChars} hud-label`}>
                      {it.chars.length > 0
                        ? it.chars.map((c) => CHARACTER_NAMES[c]).join(", ")
                        : "Heroes"}
                    </span>
                  </span>
                  <span className={styles.edge} aria-hidden="true" />
                </button>
              </li>
            );
          })
        : null}
    </ul>
  );
}
