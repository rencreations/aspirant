"use client";

import { memo, useState, type CSSProperties } from "react";

import { audio } from "@/lib/audio";

import { CanonBadge } from "../../shell/credit";
import styles from "./wall.module.css";
import type { OtherVideo } from "./types";
import { KIND_LABEL, clock, notice, pairName, stripUrl, thumbUrl } from "./video-data";

interface TileProps {
  video: OtherVideo;
  /** The viewer is open on this video: the picture is in the viewer, so the tile leaves a gap. */
  open: boolean;
  /** The visitor has opened this video before. */
  seen: boolean;
  onOpen: (video: OtherVideo) => void;
}

/**
 * One video on the wall. The tile has the picture's own shape, so a row of them is as tall as one
 * row height and ends flush, whatever the mix of wide and vertical pictures. The title is under it.
 *
 * Hover (a mouse only) steps through eight frames of the video, which is one picture moved with a
 * `transform` animation: no video is read until the visitor presses play in the viewer.
 */
function TileView({ video, open, seen, onOpen }: TileProps) {
  const [hovered, setHovered] = useState(false);
  // The strip is asked for on the first hover only, then kept (the browser has it for the next one).
  const [warm, setWarm] = useState(false);
  const label = notice(video);
  const pair = pairName(video.pair);
  const style = { "--ar": video.ar, "--field": video.c, "--n": video.strip.n } as CSSProperties;

  return (
    <li
      className={styles.tile}
      style={style}
      data-tile={video.id}
      data-open={open || undefined}
      data-seen={seen || undefined}
      data-canon={video.canon}
    >
      <button
        type="button"
        className={styles.hit}
        aria-label={`${video.title}. ${KIND_LABEL[video.kind]}, ${clock(video.video.dur)}.${seen ? " Opened before." : ""} Open`}
        data-hover={hovered || undefined}
        onClick={() => {
          audio.blip("click");
          onOpen(video);
        }}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          setWarm(true);
          setHovered(true);
        }}
        onPointerLeave={() => {
          setHovered(false);
        }}
        onBlur={() => {
          setHovered(false);
        }}
      >
        <span className={styles.figure} data-figure>
          {/* A thumbnail of the library. Plain <img>: static export, art already sized. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.poster}
            src={thumbUrl(video)}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            width={480}
            height={Math.round(480 / video.ar)}
          />
          {warm ? (
            <span className={styles.strip} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={stripUrl(video)} alt="" decoding="async" draggable={false} />
            </span>
          ) : null}
          <span className={styles.length}>{clock(video.video.dur)}</span>
          {label ? (
            <span className={styles.flag}>
              {label.kind === "badge" ? (
                <CanonBadge canon={video.canon} />
              ) : (
                <span className={`${styles.note} hud-label`}>{label.short}</span>
              )}
            </span>
          ) : null}
          <span className={styles.seen} aria-hidden="true" />
          <span className={styles.crystal} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          </span>
        </span>
        <span className={styles.caption}>
          <span className={styles.title}>{video.title}</span>
          <span className={`${styles.meta} hud-label`}>
            {KIND_LABEL[video.kind]}
            {video.group ? ` ${video.group}` : ""}
            {pair ? `, ${pair}` : ""}
          </span>
        </span>
      </button>
    </li>
  );
}

export const Tile = memo(TileView);
