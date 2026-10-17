"use client";

import { Frame } from "@/components/frame/frame";
import { FrameImage } from "@/components/frame/frame-image";
import { getPair } from "@/content/pairs";
import { audio } from "@/lib/audio";

import styles from "./cards.module.css";
import { formatDuration, pad2, spokenDuration } from "./format";
import { pairAccent, pickShape } from "./frames";
import { playTrack, usePlayer } from "./player-store";
import type { TrackItem } from "./types";

interface TrackCardProps {
  track: TrackItem;
  index: number;
}

/** A song in a ticket-stub frame. The button starts it in the mini player. */
export function TrackCard({ track, index }: TrackCardProps) {
  const current = usePlayer((s) => s.track?.id === track.id);
  const playing = usePlayer((s) => s.playing);
  const active = current && playing;
  const shape = pickShape("wide", index === 0 ? 3 : index);
  const pairName = track.pair ? getPair(track.pair).names : "";

  return (
    <button
      type="button"
      className={styles.card}
      data-kind="track"
      data-active={active}
      data-cursor={active ? "PAUSE" : "PLAY"}
      aria-label={`${active ? "Pause" : "Play"} ${track.title}, ${spokenDuration(track.durationSec)}`}
      onClick={() => {
        audio.blip("click");
        playTrack(track);
      }}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") audio.blip("hover");
      }}
    >
      <Frame
        as="span"
        shape={shape}
        accent={pairAccent(track.pair)}
        className={styles.frame}
        style={{ aspectRatio: 1.5 }}
      >
        <span className={styles.media}>
          <FrameImage
            src={track.cover.src}
            alt=""
            width={track.cover.width}
            height={track.cover.height}
            sizes="(min-width: 900px) 30vw, 90vw"
          />
          <span className={styles.scrim} aria-hidden="true" />
          <span className={styles.chip} data-pos="tl">
            {track.role}
          </span>
          <span className={styles.chip} data-pos="br" data-mono>
            {formatDuration(track.durationSec)}
          </span>
          <span className={styles.eq} data-on={active} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className={styles.play} data-state={active ? "pause" : "play"} aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              {active ? (
                <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />
              ) : (
                <path d="M8 5l12 7-12 7z" fill="currentColor" />
              )}
            </svg>
          </span>
        </span>
      </Frame>
      <span className={styles.meta} aria-hidden="true">
        <span className={`${styles.code} hud-label`}>Track {pad2(index + 1)}</span>
        <span className={styles.title}>{track.title}</span>
        <span className={styles.sub}>{pairName}</span>
        <span className={styles.credit}>{track.credit}</span>
      </span>
    </button>
  );
}
