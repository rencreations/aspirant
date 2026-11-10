"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";
import { useSiteStore } from "@/lib/stores";

import { downloadFile } from "../voicelines/download";
import { Icon } from "../voicelines/icons";
import { clock, coverUrl, creditSummary, discUrl, downloadName } from "./logic";
import styles from "./music.module.css";
import {
  changeVolume,
  closePlayer,
  playTrack,
  seekTo,
  stepTrack,
  syncPlaying,
  toggleQueue,
  togglePlayback,
  usePlayer,
} from "./player-store";
import type { MusicItem } from "./types";

/**
 * The small player of the music room. It appears when a track starts and stays in the corner
 * while the visitor turns the field: the disc, the title and the credit, previous, play and next,
 * the time with a seek bar, the volume, the queue, a download and a close button. The sound runs
 * through the shared engine, so the site's sound button and the ducking under voice lines apply.
 * Media keys and the lock screen get the title and the cover.
 */
export function PlayerBar() {
  const track = usePlayer((s) => s.track);
  if (!track) return null;
  // The key gives each track a fresh bar, so the time starts from the new element.
  return <Bar key={track.id} track={track} />;
}

function Bar({ track }: { track: MusicItem }) {
  const playing = usePlayer((s) => s.playing);
  const volume = usePlayer((s) => s.volume);
  const queue = usePlayer((s) => s.queue);
  const queueOpen = usePlayer((s) => s.queueOpen);
  const muted = useSiteStore((s) => s.muted);
  const toggleMute = useSiteStore((s) => s.toggleMute);
  const [time, setTime] = useState(() => audio.getMusicElement()?.currentTime ?? 0);
  const [duration, setDuration] = useState(track.dur);
  const trackId = track.id;

  // Follow the media element of this track.
  useEffect(() => {
    const el = audio.getMusicElement();
    if (!el) return;
    const onTime = () => {
      setTime(el.currentTime);
    };
    const onMeta = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
    };
    const onPlay = () => {
      syncPlaying(true);
    };
    const onPause = () => {
      syncPlaying(false);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("seeked", onTime);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("playing", onPlay);
    el.addEventListener("pause", onPause);
    onMeta();
    // A refused start (an autoplay rule) must not show as playing.
    const check = window.setTimeout(() => {
      if (el.paused && !el.ended) syncPlaying(false);
    }, 1500);
    return () => {
      window.clearTimeout(check);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("seeked", onTime);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("playing", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [trackId]);

  // Media Session: the title and the cover on lock screens, and the media keys.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    try {
      session.metadata = new MediaMetadata({
        title: track.title,
        artist: creditSummary(track),
        album: "The Aspirants",
        artwork: [
          { src: new URL(coverUrl(track.cover, "p"), window.location.href).href, sizes: "512x512" },
        ],
      });
      session.setActionHandler("play", () => {
        togglePlayback();
      });
      session.setActionHandler("pause", () => {
        togglePlayback();
      });
      session.setActionHandler("previoustrack", () => {
        stepTrack(-1);
      });
      session.setActionHandler("nexttrack", () => {
        stepTrack(1);
      });
      session.setActionHandler("seekto", (d) => {
        if (d.seekTime !== undefined) seekTo(d.seekTime);
      });
    } catch {
      /* Media Session is optional. */
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
    if ("mediaSession" in navigator)
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  const total = duration || track.dur;
  const shown = Math.min(time, total);
  const fill = total ? shown / total : 0;

  return (
    <section
      className={styles.player}
      aria-label="Music player"
      data-theme="storm"
      data-playing={playing}
      data-ui=""
    >
      {queueOpen ? (
        <div className={styles.queue} role="region" aria-label="Queue">
          <div className={styles.queueHead}>
            <p className={styles.queueTitle}>Up next, {queue.length}</p>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Close the queue"
              onClick={() => {
                toggleQueue(false);
              }}
            >
              <Icon name="close" />
            </button>
          </div>
          <ol className={styles.queueList}>
            {queue.map((t, i) => (
              <li key={t.id} data-current={t.id === trackId ? "true" : undefined}>
                <button
                  type="button"
                  className={styles.queuePick}
                  onClick={() => {
                    audio.unlock();
                    playTrack(t);
                  }}
                >
                  <span className={styles.queueNum}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={styles.queueName}>{t.title}</span>
                  <span className={styles.queueNum}>{clock(t.dur)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className={styles.playerTop}>
        <span className={styles.playerDisc} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={discUrl(track)} alt="" width={48} height={48} />
        </span>
        <div className={styles.playerText}>
          <p className={styles.playerKicker}>
            <span className={styles.liveDot} data-on={playing} aria-hidden="true" />
            {playing ? "Now playing" : "Paused"}
          </p>
          <p className={styles.playerTitle} aria-live="polite">
            {track.title}
          </p>
          <p className={styles.playerCredit}>{creditSummary(track)}</p>
        </div>
        <div className={styles.transport}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Previous track"
            onClick={() => {
              stepTrack(-1);
            }}
          >
            <Icon name="prev" />
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.mainBtn}`}
            aria-label={playing ? "Pause" : "Play"}
            aria-pressed={playing}
            onClick={togglePlayback}
          >
            <Icon name={playing ? "pause" : "play"} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Next track"
            onClick={() => {
              stepTrack(1);
            }}
          >
            <Icon name="next" />
          </button>
        </div>
      </div>

      <div className={styles.playerBottom}>
        <span className={styles.time}>{clock(shown)}</span>
        <input
          type="range"
          className={styles.range}
          aria-label="Seek"
          min={0}
          max={Math.max(1, Math.round(total * 10) / 10)}
          step={0.1}
          value={shown}
          aria-valuetext={`${clock(shown)} of ${clock(total)}`}
          onChange={(e) => {
            const next = Number(e.target.value);
            setTime(next);
            seekTo(next);
          }}
          style={{ "--fill": fill } as CSSProperties}
        />
        <span className={styles.time}>{clock(total)}</span>
        <label className={styles.volume}>
          <span className="sr-only">Volume</span>
          <Icon name="volume" />
          <input
            type="range"
            className={styles.range}
            aria-label="Volume"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => {
              changeVolume(Number(e.target.value));
            }}
            style={{ "--fill": volume } as CSSProperties}
          />
        </label>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={`Queue, ${queue.length} ${queue.length === 1 ? "track" : "tracks"}`}
          aria-pressed={queueOpen}
          onClick={() => {
            toggleQueue();
          }}
        >
          <Icon name="queue" />
        </button>
        <a
          className={styles.iconBtn}
          href={libUrl(track.orig ?? track.src)}
          download={downloadName(track)}
          aria-label={`Download ${track.title}`}
          onClick={(e) => {
            e.preventDefault();
            void downloadFile(libUrl(track.orig ?? track.src), downloadName(track));
          }}
        >
          <Icon name="download" />
        </a>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Close the player"
          onClick={closePlayer}
        >
          <Icon name="close" />
        </button>
      </div>

      {muted ? (
        <button
          type="button"
          className={styles.mutedNote}
          onClick={() => {
            audio.unlock();
            toggleMute();
          }}
        >
          Sound is off. Turn it on
        </button>
      ) : null}
    </section>
  );
}
