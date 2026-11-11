"use client";

import { memo, useCallback, useEffect, useState, type ReactNode } from "react";

import { libUrl } from "@/lib/library";

import type { ArtsItem } from "../types";
import { useZoomTile } from "../zoom";
import styles from "./flow.module.css";
import type { FlowMetrics, FlowRow } from "./math";
import { pickSize } from "./math";
import { noteShown, wasShown } from "./warm";

/**
 * A row's pictures are asked for once the row has stood in the page this long (unless it is on
 * the screen at once), so rows that fly by in a fast scroll are never requested.
 */
const ARM_MS = 120;

interface TileProps {
  id: string;
  src: string;
  alt: string;
  w: number;
  h: number;
  colour: string;
  armed: boolean;
  overlay: ReactNode;
}

function onLoad(event: React.SyntheticEvent<HTMLImageElement>): void {
  const img = event.currentTarget;
  img.dataset.ready = "";
  noteShown(img.currentSrc || img.src);
}

function onError(event: React.SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.dataset.failed = "";
}

/** One picture: a button that opens the zoom, with its average colour behind it until the picture arrives. */
const Tile = memo(function Tile({ id, src, alt, w, h, colour, armed, overlay }: TileProps) {
  const zoom = useZoomTile(id, "light");
  // A picture that showed before is in the cache: it stands at once, with no fade.
  const known = wasShown(src);
  // A picture that is in the cache by the time its tile stands is shown at once too.
  const ref = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) {
      img.dataset.instant = "";
      img.dataset.ready = "";
    }
  }, []);
  return (
    <button
      type="button"
      {...zoom}
      className={`${zoom.className} ${styles.tile}`}
      data-flow-tile=""
      data-id={id}
      aria-label={alt}
      style={{ width: w, height: h, backgroundColor: colour }}
    >
      <span className={styles.frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={ref}
          className={styles.pic}
          src={armed || known ? src : undefined}
          alt=""
          width={w}
          height={h}
          decoding="async"
          draggable={false}
          onLoad={onLoad}
          onError={onError}
          {...(known ? { "data-instant": "", "data-ready": "" } : {})}
        />
      </span>
      {overlay}
    </button>
  );
});

interface RowProps<T extends ArtsItem> {
  row: FlowRow;
  m: FlowMetrics;
  items: readonly T[];
  dpr: number;
  /** The row is on the screen as it stands in the page: its pictures are asked for at once. */
  eager: boolean;
  place: (el: HTMLElement | null, row: FlowRow, m: FlowMetrics) => void;
  overlay?: (item: T) => ReactNode;
}

function RowInner<T extends ArtsItem>({ row, m, items, dpr, eager, place, overlay }: RowProps<T>) {
  const [armed, setArmed] = useState(eager);
  useEffect(() => {
    if (armed) return;
    const timer = window.setTimeout(() => {
      setArmed(true);
    }, ARM_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [armed]);

  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      place(el, row, m);
    },
    [place, row, m],
  );
  const tiles: ReactNode[] = [];
  for (let k = 0; k < row.count; k++) {
    const item = items[row.start + k];
    const w = row.widths[k];
    if (!item || w === undefined) continue;
    tiles.push(
      <Tile
        key={item.id}
        id={item.id}
        src={libUrl(item.img[pickSize(w, m.rowH, dpr)])}
        alt={item.alt}
        w={w}
        h={m.rowH}
        colour={item.img.c}
        armed={armed}
        overlay={overlay ? overlay(item) : null}
      />,
    );
  }
  return (
    <div
      ref={ref}
      className={styles.row}
      data-flow-row={row.index}
      data-dir={row.dir}
      style={{ top: row.top, width: row.content, height: m.rowH, gap: m.gap }}
    >
      {tiles}
    </div>
  );
}

export const Row = memo(RowInner) as typeof RowInner;
