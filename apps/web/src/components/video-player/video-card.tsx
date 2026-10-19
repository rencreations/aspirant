"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";

import { PlayerOverlay, type PlayerVideo } from "./player-overlay";
import { formatTime } from "./player-math";
import styles from "./video-card.module.css";

interface VideoCardProps {
  video: PlayerVideo;
  /** Length in seconds, shown on the card. */
  duration?: number;
  /** Small label on the card, for example "Trailer". */
  tag?: string;
  className?: string;
}

/**
 * A video thumbnail with the site's play button. The video never starts by itself: a click grows
 * the custom player out of the thumbnail to fill the page, and it plays from there.
 */
export function VideoCard({ video, duration, tag = "Video", className }: VideoCardProps) {
  const [open, setOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const ref = useRef<HTMLButtonElement>(null);
  const getOrigin = useCallback(() => ref.current?.getBoundingClientRect() ?? null, []);

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={[styles.card, className].filter(Boolean).join(" ")}
        aria-label={`Play video: ${video.title}`}
        aria-haspopup="dialog"
        data-cursor="PLAY"
        data-open={open}
        onPointerEnter={() => {
          audio.blip("hover");
        }}
        onClick={() => {
          setBurst((b) => b + 1);
          setOpen(true);
        }}
      >
        {/* Plain <img>: static export, art already sized. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.poster} src={asset(video.poster)} alt="" draggable={false} />
        <span className={styles.shade} aria-hidden="true" />
        <span className={styles.play} aria-hidden="true">
          <span key={burst} className={styles.burst} data-on={burst > 0} />
          <span className={styles.ring} />
          <span className={styles.crystal}>
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          </span>
        </span>
        <span className={styles.meta}>
          <span className={styles.tag}>{tag}</span>
          {duration ? <span className={styles.length}>{formatTime(duration)}</span> : null}
        </span>
      </button>
      {open
        ? createPortal(
            <PlayerOverlay
              video={video}
              getOrigin={getOrigin}
              onClosed={() => {
                setOpen(false);
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}
