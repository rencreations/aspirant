"use client";

import { audio } from "@/lib/audio";
import { useMounted } from "@/lib/hooks";
import { toggleMusic, useNowPlaying } from "@/lib/now-playing";
import { asset } from "@/lib/asset";
import { useSiteStore } from "@/lib/stores";

import styles from "./now-playing.module.css";

/**
 * The record widget beside the sound button: a small vinyl with the album art on its label, the
 * song and the artist. It spins while the music plays and stops when it is paused or the sound
 * is off, and a tone arm lowers onto it. A click pauses or resumes the music. It only shows on
 * pages that have a track (see `startMusic`).
 */
export function NowPlaying() {
  const track = useNowPlaying((s) => s.track);
  const playing = useNowPlaying((s) => s.playing);
  const muted = useSiteStore((s) => s.muted);
  const mounted = useMounted();
  if (!track || !mounted) return null;
  const spinning = playing && !muted;
  return (
    <button
      type="button"
      className={styles.widget}
      aria-pressed={playing}
      aria-label={`${track.title}, ${track.artist}. ${playing ? "Pause" : "Play"} the music`}
      title={`${track.title} by ${track.artist}`}
      data-cursor={playing ? "PAUSE" : "PLAY"}
      data-spin={spinning}
      onPointerEnter={() => {
        audio.blip("hover");
      }}
      onClick={() => {
        audio.unlock();
        toggleMusic();
        audio.blip("click");
      }}
    >
      <span className={styles.player} aria-hidden="true">
        <span className={styles.disc}>
          <span className={styles.grooves} />
          {/* Plain <img>: static export. The album art is the record's label. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.label} src={asset(track.cover)} alt="" draggable={false} />
          <span className={styles.hole} />
        </span>
        <svg className={styles.arm} viewBox="0 0 40 40" width="40" height="40" focusable="false">
          <circle cx="33" cy="7" r="3.2" fill="currentColor" />
          <path
            d="M33 7 L33 21 L25 33"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <rect
            x="21.5"
            y="31"
            width="6"
            height="3.4"
            fill="currentColor"
            transform="rotate(35 24 33)"
          />
        </svg>
      </span>
      <span className={styles.meta} aria-hidden="true">
        <span className={styles.title}>{track.title}</span>
        <span className={styles.artist}>{track.artist}</span>
      </span>
    </button>
  );
}
