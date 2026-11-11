"use client";

import { memo, useCallback, type ReactNode } from "react";

import { libUrl } from "@/lib/library";

import type { ArtsItem } from "../types";
import { useZoomTile } from "../zoom";
import styles from "./flow.module.css";
import type { FlowMetrics, FlowRow } from "./math";
import { pickSize } from "./math";
import { noteShown, wasShown } from "./warm";

interface TileProps {
  id: string;
  src: string;
  alt: string;
  w: number;
  h: number;
  colour: string;
  /** On the first screen: asked for at once, before anything else. The others load as they near the screen. */
  eager: boolean;
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
const Tile = memo(function Tile({ id, src, alt, w, h, colour, eager, overlay }: TileProps) {
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
          src={src}
          alt=""
          width={w}
          height={h}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
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
  index: number;
  m: FlowMetrics;
  items: readonly T[];
  dpr: number;
  /** The row is one of the first: its pictures are asked for at once. */
  eager: boolean;
  overlay?: (item: T) => ReactNode;
}

function RowInner<T extends ArtsItem>({ row, index, m, items, dpr, eager, overlay }: RowProps<T>) {
  const tiles: ReactNode[] = [];
  for (let k = 0; k < row.count; k++) {
    const item = items[row.start + k];
    const w = row.widths[k];
    if (!item || w === undefined) continue;
    tiles.push(
      <Tile
        key={item.id}
        id={item.id}
        src={libUrl(item.img[pickSize(w, row.height, dpr)])}
        alt={item.alt}
        w={w}
        h={row.height}
        colour={item.img.c}
        eager={eager}
        overlay={overlay ? overlay(item) : null}
      />,
    );
  }
  return (
    <div className={styles.row} data-flow-row={index} style={{ height: row.height, gap: m.gap }}>
      {tiles}
    </div>
  );
}

export const Row = memo(RowInner) as typeof RowInner;
