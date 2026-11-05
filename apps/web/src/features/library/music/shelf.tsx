"use client";

import { memo, type CSSProperties } from "react";

import { audio } from "@/lib/audio";

import { clock, coverUrl } from "./logic";
import styles from "./music.module.css";
import { playTrack, usePlayer } from "./player-store";
import type { MusicItem } from "./types";

interface SleeveProps {
  item: MusicItem;
  index: number;
  list: readonly MusicItem[];
}

/**
 * One record on the shelf. The sleeve leans forward when the pointer is on it. The record that
 * plays slides out of its sleeve and turns (transform only, so it costs next to nothing).
 */
const Sleeve = memo(function Sleeve({ item, index, list }: SleeveProps) {
  const current = usePlayer((s) => s.track?.id === item.id);
  const playing = usePlayer((s) => s.playing && s.track?.id === item.id);
  const src = coverUrl(item.cover, "t");

  return (
    <li className={styles.cell} style={{ "--i": index } as CSSProperties}>
      <button
        type="button"
        className={styles.sleeve}
        aria-label={`${playing ? "Pause" : "Play"} ${item.title}`}
        aria-pressed={playing}
        data-current={current}
        data-playing={playing}
        onClick={() => {
          playTrack(item, list);
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") audio.blip("hover");
        }}
      >
        <span className={styles.stage}>
          <span className={styles.disc} aria-hidden="true">
            <span className={styles.discSpin}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" width={96} height={96} loading="lazy" decoding="async" />
            </span>
          </span>
          <span className={styles.jacket}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" width={320} height={320} decoding="async" />
            {item.ep ? <span className={`${styles.epTag} hud-label`}>{item.ep}</span> : null}
            <span className={styles.playMark} aria-hidden="true">
              {playing ? "Playing" : current ? "Paused" : "Play"}
            </span>
          </span>
        </span>
        <span className={styles.labels}>
          <span className={styles.sleeveTitle}>{item.title}</span>
          <span className={`${styles.sleeveSub} hud-label`}>
            {clock(item.dur)}
            {item.released ? ` / ${item.released}` : ""}
          </span>
        </span>
      </button>
    </li>
  );
});

/** The tracks as records on shelves of five. A press plays the record and queues the shelf after it. */
export function Shelf({ items }: { items: readonly MusicItem[] }) {
  return (
    <ol className={styles.shelf} aria-label="Records">
      {items.map((item, i) => (
        <Sleeve key={item.id} item={item} index={i} list={items} />
      ))}
    </ol>
  );
}
