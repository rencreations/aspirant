"use client";

import { memo, type CSSProperties } from "react";

import { Tile } from "./tile";
import styles from "./wall.module.css";
import type { OtherVideo } from "./types";
import { SHELF_HEAD, runtimeWords, totalRuntime, type Group } from "./video-data";

interface ShelfProps {
  group: Group;
  /** Position on the wall, from 1. */
  number: number;
  /** Build the tiles now. A shelf that is not built yet is a block of the right height. */
  built: boolean;
  /** About how tall the shelf is, in pixels (see `estimateShelf`). */
  estimate: number;
  openId: string;
  seen: ReadonlySet<string>;
  onOpen: (video: OtherVideo) => void;
}

function ShelfView({ group, number, built, estimate, openId, seen, onOpen }: ShelfProps) {
  const headId = `shelf-title-${group.id}`;
  return (
    <section
      id={`shelf-${group.id}`}
      className={styles.shelf}
      data-shelf={group.id}
      aria-labelledby={headId}
      style={{ "--est": `${estimate}px` } as CSSProperties}
    >
      <header className={styles.shelfHead}>
        <span className={`${styles.shelfNo} hud-label`}>{String(number).padStart(2, "0")}</span>
        <h2 id={headId} className={`${styles.shelfTitle} display`}>
          {group.title}
        </h2>
        <p className={styles.shelfNote}>{group.note}</p>
        <p className={`${styles.shelfStats} hud-label`}>
          {group.items.length} {group.items.length === 1 ? "video" : "videos"},{" "}
          {runtimeWords(totalRuntime(group.items))}
        </p>
      </header>
      {built ? (
        <ul className={styles.row}>
          {group.items.map((video) => (
            <Tile
              key={video.id}
              video={video}
              open={openId === video.id}
              seen={seen.has(video.id)}
              onOpen={onOpen}
            />
          ))}
        </ul>
      ) : (
        <div className={styles.pending} style={{ height: Math.max(0, estimate - SHELF_HEAD) }} />
      )}
    </section>
  );
}

export const Shelf = memo(ShelfView);
