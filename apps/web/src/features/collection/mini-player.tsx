"use client";

import { useEffect, useRef, useState } from "react";

import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useMounted } from "@/lib/hooks";
import { useSiteStore } from "@/lib/stores";

import type { TrackItem } from "./types";
import { formatDuration, spokenDuration } from "./format";
import styles from "./mini-player.module.css";
import {
  changeVolume,
  closePlayer,
  seekTo,
  stepTrack,
  syncPlaying,
  togglePlayback,
  usePlayer,
} from "./player-store";

const BARS = 36;

/** Frequency bars from the music analyser. Draws only while a track plays. */
function MusicWave({ playing }: { playing: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const color = getComputedStyle(canvas).color;
    const levels = new Float32Array(BARS);
    const bins = new Uint8Array(512);
    let raf = 0;

    const size = () => {
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    };
    size();

    const draw = () => {
      const analyser = audio.getMusicAnalyser();
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      if (playing && analyser) {
        analyser.getByteFrequencyData(bins);
        // Use the lower three quarters of the spectrum: the top is mostly empty for AAC.
        const span = Math.floor(bins.length * 0.55);
        for (let i = 0; i < BARS; i++) {
          const from = Math.floor((i / BARS) ** 1.5 * span);
          const to = Math.max(from + 1, Math.floor(((i + 1) / BARS) ** 1.5 * span));
          let peak = 0;
          for (let j = from; j < to; j++) peak = Math.max(peak, bins[j] ?? 0);
          const prev = levels[i] ?? 0;
          levels[i] = prev + (peak / 255 - prev) * 0.4;
        }
      } else {
        for (let i = 0; i < BARS; i++) levels[i] = (levels[i] ?? 0) * 0.86;
      }
      const gap = w / BARS;
      const bw = Math.max(1, gap * 0.52);
      ctx.fillStyle = color;
      for (let i = 0; i < BARS; i++) {
        const bh = Math.max(dpr * 1.5, (levels[i] ?? 0) * h);
        ctx.globalAlpha = 0.45 + (levels[i] ?? 0) * 0.55;
        ctx.fillRect(i * gap + (gap - bw) / 2, h - bh, bw, bh);
      }
      const settled = !playing && levels.every((v) => v < 0.01);
      raf = settled ? 0 : requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(() => {
      size();
      if (!raf) draw();
    });
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [playing]);

  return <canvas ref={ref} className={styles.wave} aria-hidden="true" />;
}

function Icon({ name }: { name: "play" | "pause" | "prev" | "next" | "close" | "volume" }) {
  const paths: Record<typeof name, string> = {
    play: "M5 3l9 6-9 6z",
    pause: "M4 3h3v12H4zM11 3h3v12h-3z",
    prev: "M4 3h2v12H4zM15 3v12L7 9z",
    next: "M12 3h2v12h-2zM3 3l8 6-8 6z",
    close: "M3 3l12 12M15 3L3 15",
    volume: "M2 7h3l4-3v10l-4-3H2zM12 6.5a3.5 3.5 0 010 5M14 4.5a6 6 0 010 9",
  };
  const stroked = name === "close" || name === "volume";
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false" className={styles.icon}>
      <path
        d={paths[name]}
        fill={stroked ? "none" : "currentColor"}
        stroke={stroked ? "currentColor" : "none"}
        strokeWidth="1.6"
      />
    </svg>
  );
}

/**
 * The persistent mini player. It appears at the bottom once a track starts and stays while
 * the visitor browses. Audio runs through the shared engine, so the site's mute switch and the
 * voice ducking apply. Media Session metadata puts the track on lock screens and media keys.
 */
export function MiniPlayer() {
  const mounted = useMounted();
  const track = usePlayer((s) => s.track);
  if (!mounted || !track) return null;
  // The key gives each track a fresh bar, so time and duration start from the new element.
  return <PlayerBar key={track.id} track={track} />;
}

function PlayerBar({ track }: { track: TrackItem }) {
  const playing = usePlayer((s) => s.playing);
  const volume = usePlayer((s) => s.volume);
  const queueLength = usePlayer((s) => s.queue.length);
  const muted = useSiteStore((s) => s.muted);
  const toggleMute = useSiteStore((s) => s.toggleMute);
  const [time, setTime] = useState(() => audio.getMusicElement()?.currentTime ?? 0);
  const [duration, setDuration] = useState(() => {
    const d = audio.getMusicElement()?.duration;
    return d !== undefined && Number.isFinite(d) && d > 0 ? d : 0;
  });
  const trackId = track.id;

  // Follow the audio element of the current track.
  useEffect(() => {
    const el = audio.getMusicElement();
    if (!el) return;
    const onTime = () => setTime(el.currentTime);
    const onMeta = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
    };
    const onPlay = () => syncPlaying(true);
    const onPause = () => syncPlaying(false);
    const onEnded = () => {
      syncPlaying(false);
      stepTrack(1);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("playing", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    // Playback can be refused (autoplay rules). Drop the optimistic "playing" state then.
    const check = window.setTimeout(() => {
      if (el.paused) syncPlaying(false);
    }, 900);
    return () => {
      window.clearTimeout(check);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("playing", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [trackId]);

  // Media Session: title, artwork, and the media keys.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    try {
      session.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist ?? "Aspirant archive",
        album: "Aspirant collection",
        artwork: [
          {
            src: new URL(asset(track.cover.src), window.location.href).href,
            sizes: `${track.cover.width}x${track.cover.height}`,
            type: "image/webp",
          },
        ],
      });
      session.setActionHandler("play", () => togglePlayback());
      session.setActionHandler("pause", () => togglePlayback());
      session.setActionHandler("previoustrack", () => stepTrack(-1));
      session.setActionHandler("nexttrack", () => stepTrack(1));
      session.setActionHandler("seekto", (d) => {
        if (d.seekTime !== undefined) seekTo(d.seekTime);
      });
    } catch {
      /* Media Session is optional */
    }
    return () => {
      try {
        for (const action of ["play", "pause", "previoustrack", "nexttrack", "seekto"] as const) {
          session.setActionHandler(action, null);
        }
      } catch {
        /* ignore */
      }
    };
  }, [track]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  const total = duration || track.durationSec;

  return (
    <section
      className={styles.player}
      aria-label="Music player"
      data-theme="storm"
      data-open="true"
    >
      <div className={styles.bg} aria-hidden="true" />
      <div className={styles.cover} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset(track.cover.src)}
          alt=""
          width={track.cover.width}
          height={track.cover.height}
        />
      </div>
      <div className={styles.info}>
        <p className={styles.kicker}>
          <span className={styles.dot} data-on={playing} aria-hidden="true" />
          {playing ? "Now playing" : "Paused"}
        </p>
        <p className={styles.title} aria-live="polite">
          {track.title}
        </p>
      </div>

      <div className={styles.transport}>
        <button
          type="button"
          className={styles.btn}
          onClick={() => stepTrack(-1)}
          disabled={queueLength < 2}
          aria-label="Previous track"
        >
          <Icon name="prev" />
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.main}`}
          onClick={togglePlayback}
          aria-label={playing ? "Pause" : "Play"}
          aria-pressed={playing}
          data-cursor={playing ? "PAUSE" : "PLAY"}
        >
          <Icon name={playing ? "pause" : "play"} />
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => stepTrack(1)}
          disabled={queueLength < 2}
          aria-label="Next track"
        >
          <Icon name="next" />
        </button>
      </div>

      <div className={styles.seek}>
        <span className={styles.time}>{formatDuration(time)}</span>
        <input
          type="range"
          className={styles.range}
          aria-label="Seek"
          min={0}
          max={Math.max(1, Math.round(total * 10) / 10)}
          step={0.1}
          value={Math.min(time, total || time)}
          aria-valuetext={`${spokenDuration(time)} of ${spokenDuration(total)}`}
          onChange={(e) => {
            const next = Number(e.target.value);
            setTime(next);
            seekTo(next);
          }}
          style={
            {
              "--fill": `${total ? Math.min(100, (time / total) * 100) : 0}%`,
            } as React.CSSProperties
          }
        />
        <span className={styles.time}>{formatDuration(total)}</span>
      </div>

      <MusicWave playing={playing && !muted} />

      <div className={styles.volume}>
        <Icon name="volume" />
        <input
          type="range"
          className={styles.range}
          aria-label="Volume"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => changeVolume(Number(e.target.value))}
          style={{ "--fill": `${volume * 100}%` } as React.CSSProperties}
        />
      </div>

      {muted && (
        <button
          type="button"
          className={styles.muted}
          onClick={() => {
            audio.unlock();
            toggleMute();
          }}
        >
          Sound is off. Turn it on
        </button>
      )}

      <button type="button" className={styles.btn} onClick={closePlayer} aria-label="Close player">
        <Icon name="close" />
      </button>
    </section>
  );
}
