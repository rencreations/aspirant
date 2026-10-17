"use client";

import type { CSSProperties } from "react";

import { Frame } from "@/components/frame/frame";
import { FrameImage } from "@/components/frame/frame-image";
import { audio } from "@/lib/audio";

import styles from "./cards.module.css";
import { orientationOf, pairAccent, pickShape, shapeRatio } from "./frames";
import type { ArtItem, FanArtItem } from "./types";

/** Height of a row in the justified gallery. Frames grow to fill the row. */
const ROW_HEIGHT = "var(--row-h)";

interface GalleryCardProps {
  item: ArtItem | FanArtItem;
  /** Position in the full list, so the shape of a card never changes while filtering. */
  index: number;
  onOpen: (item: ArtItem | FanArtItem, opener: HTMLElement) => void;
}

/** Style for the list item: its share of the row follows the ratio of its frame. */
export function galleryCellStyle(ratio: number): CSSProperties {
  return {
    flexGrow: ratio * 100,
    flexBasis: `calc(${ROW_HEIGHT} * ${ratio.toFixed(3)})`,
    maxWidth: `calc(${ROW_HEIGHT} * ${(ratio * 2.2).toFixed(3)})`,
  };
}

/** The ratio a gallery item's frame takes, used for both the cell and the frame. */
export function galleryRatio(item: ArtItem | FanArtItem, index: number): number {
  const imageRatio = item.thumbWidth / item.thumbHeight;
  return shapeRatio(pickShape(orientationOf(item.thumbWidth, item.thumbHeight), index), imageRatio);
}

/** One piece of official or fan art in a custom frame. Opens the viewer. */
export function GalleryCard({ item, index, onOpen }: GalleryCardProps) {
  const orientation = orientationOf(item.thumbWidth, item.thumbHeight);
  const shape = pickShape(orientation, index);
  const ratio = shapeRatio(shape, item.thumbWidth / item.thumbHeight);
  const isFan = item.kind === "fanart";
  const accent = isFan ? item.color : pairAccent(item.pair);
  const alpha = item.kind === "art" && item.alpha;

  return (
    <button
      type="button"
      className={styles.card}
      data-kind={item.kind}
      data-cursor="VIEW"
      aria-label={`View ${item.title}${isFan ? `. ${item.credit}` : ""}`}
      onClick={(e) => {
        audio.blip("click");
        onOpen(item, e.currentTarget);
      }}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") audio.blip("hover");
      }}
    >
      <Frame
        as="span"
        shape={shape}
        accent={accent}
        className={styles.frame}
        style={{ aspectRatio: ratio }}
        label={undefined}
      >
        <span className={styles.media} data-alpha={alpha}>
          <FrameImage
            src={item.thumb}
            alt=""
            width={item.thumbWidth}
            height={item.thumbHeight}
            sizes="(min-width: 900px) 24vw, 70vw"
            className={alpha ? "object-contain!" : undefined}
            objectPosition={orientation === "tall" ? "50% 15%" : undefined}
          />
          <span className={styles.scrim} data-soft aria-hidden="true" />
          <span className={styles.chip} data-pos="tl">
            {item.kind === "art" ? item.artKind : "Fan art"}
          </span>
          <span className={styles.play} data-state="view" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path
                d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </span>
        </span>
      </Frame>
      <span className={styles.meta} aria-hidden="true" data-compact>
        <span className={styles.title}>{item.title}</span>
      </span>
    </button>
  );
}
