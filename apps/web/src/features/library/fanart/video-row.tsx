"use client";

import { useEffect, useRef } from "react";

import { VideoCard } from "@/components/video-player/video-card";
import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";
import { CHARACTER_NAMES } from "@/lib/slugs";

import { CanonBadge, CreditLine } from "../shell/credit";
import { canonLabel, formatDate } from "./model";
import type { FanItem } from "./types";
import styles from "./video-row.module.css";

interface RowProps {
  videos: readonly FanItem[];
  /** A video named by `?i=` is brought into view. */
  focusId: string;
  /** Show every video in a grid instead of one row (the Videos filter). */
  grid: boolean;
}

/** One fan video: the site's player card, its badge and its credit. */
export function VideoEntry({ item }: { item: FanItem }) {
  if (!item.video) return null;
  const date = formatDate(item.date);
  const reel = item.canon !== "fan";
  return (
    <article className={styles.entry} data-video={item.id} aria-label={item.title}>
      <VideoCard
        video={{
          sources: [{ label: "Original", height: item.video.h, src: libUrl(item.video.src) }],
          poster: libUrl(item.video.poster),
          title: item.title,
        }}
        duration={item.video.dur}
        tag={reel ? "Official reel" : "Fan video"}
        className={styles.card}
      />
      <div className={styles.meta} style={{ ["--c" as string]: item.img.c }}>
        <h3 className={`${styles.title} display`}>{item.title}</h3>
        <p className={styles.badges}>
          {reel ? (
            <span className={styles.reel + " hud-label"}>{canonLabel(item)}</span>
          ) : (
            <CanonBadge canon={item.canon} />
          )}
          {date ? <span className="hud-label">{date}</span> : null}
        </p>
        <CreditLine credit={item.credit} canon={item.canon} />
        {item.credit?.note ? <p className={styles.note}>{item.credit.note}</p> : null}
        <p className={`${styles.who} hud-label`}>
          {item.chars.map((c) => CHARACTER_NAMES[c]).join(", ")}
        </p>
      </div>
    </article>
  );
}

export function VideoRow({ videos, focusId, grid }: RowProps) {
  const track = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!focusId) return;
    const el = track.current?.querySelector<HTMLElement>(`[data-video="${focusId}"]`);
    el?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  }, [focusId]);

  const step = (dir: 1 | -1) => {
    audio.blip("click");
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: "smooth" });
  };

  if (videos.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="fan-videos">
      <div className="shell">
        <div className={styles.head}>
          <h2 id="fan-videos" className={`${styles.heading} display`}>
            Fan videos
          </h2>
          <p className={`${styles.count} hud-label`}>
            {videos.length} {videos.length === 1 ? "video" : "videos"}
            {videos.some((v) => v.canon !== "fan")
              ? `, ${videos.filter((v) => v.canon !== "fan").length} of them official reels`
              : ""}
          </p>
          {grid ? null : (
            <div className={styles.arrows}>
              <button
                type="button"
                className={styles.arrow}
                aria-label="Earlier videos"
                onClick={() => {
                  step(-1);
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              </button>
              <button
                type="button"
                className={styles.arrow}
                aria-label="Later videos"
                onClick={() => {
                  step(1);
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
      <div className={grid ? "shell" : styles.bleed}>
        <ul ref={track} className={grid ? styles.grid : styles.track}>
          {videos.map((v, i) => (
            <li key={v.id} className={styles.item} style={{ ["--i" as string]: Math.min(i, 8) }}>
              <VideoEntry item={v} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
