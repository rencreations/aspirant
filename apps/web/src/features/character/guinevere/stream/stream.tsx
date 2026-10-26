"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { audio } from "@/lib/audio";
import { mediaUrl } from "@/lib/media-store";
import { useSiteStore } from "@/lib/stores";

import { PlayerButton, videoFor } from "../shared/player-button";
import { videoInfo } from "../shared/info";
import { useVideoSlot } from "../../vexana/shared/use-video-slot";
import { STREAM_COMMENTS } from "./comments.generated";
import { TAGS } from "./stream-data";
import { useMusicDuck } from "./use-duck";
import styles from "./stream.module.css";

const clock = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
};

/** Chat lines shown at a time. */
const CHAT_SHOWN = 8;

/**
 * 05, the livestream. Her stream (a vertical livestream) in a studio of its own: an acoustic wall,
 * a ring light, an ON AIR sign, the picture on a phone and a chat beside it. The viewers' comments
 * fly across the top of the video itself (they are part of the picture), and the chat lists the
 * same comments, read from the video by `scripts/guinevere/comments.py`, each at the second it
 * entered (`comments.generated.ts`). Nothing here is invented. The video streams (nothing is
 * fetched until it plays), and the site's player opens it large.
 */
export function Stream() {
  const info = useMemo(() => videoInfo("live-guin"), []);
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const chatRef = useRef<HTMLOListElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);

  // The sound: the stream starts muted by itself (a browser allows that), and the visitor turns
  // the sound on with the button. The site's sound button still has the last word.
  const [soundOn, setSoundOn] = useState(false);
  const soundRef = useRef(false);
  const [siteMuted, setSiteMuted] = useState(() => useSiteStore.getState().muted);
  useEffect(() => useSiteStore.subscribe((s) => setSiteMuted(s.muted)), []);
  const silent = !soundOn || siteMuted;
  useEffect(() => {
    soundRef.current = soundOn;
    const el = video.current;
    if (el) el.muted = !soundOn || siteMuted;
  }, [soundOn, siteMuted]);

  const duck = useMusicDuck();
  // The visitor pressed pause: the stream stays stopped until they press play.
  const stopped = useRef(false);
  const isMuted = useCallback(() => !soundRef.current || useSiteStore.getState().muted, []);
  const blocked = useCallback(() => {
    setSoundOn(false);
  }, []);
  useVideoSlot(video, frame, info.src, {
    auto: true,
    stopped,
    muted: isMuted,
    onSoundBlocked: blocked,
  });

  /** Make sure the file is given to the video (it may not be, far from the screen). */
  const ensureSource = useCallback(() => {
    const el = video.current;
    if (el && !el.getAttribute("src")) {
      el.src = mediaUrl(info.src);
      el.load();
    }
  }, [info.src]);

  const toggle = useCallback(() => {
    const el = video.current;
    if (!el) return;
    audio.blip("click");
    if (el.paused) {
      stopped.current = false;
      ensureSource();
      void el.play().catch(() => undefined);
    } else {
      stopped.current = true;
      el.pause();
    }
  }, [ensureSource]);

  /** Sound on (turning the site's sound on too if it was off), or off again. */
  const toggleSound = useCallback(() => {
    const el = video.current;
    if (!el) return;
    audio.blip("click");
    if (soundRef.current && !useSiteStore.getState().muted) {
      soundRef.current = false;
      setSoundOn(false);
      el.muted = true;
      return;
    }
    if (useSiteStore.getState().muted) {
      audio.unlock();
      useSiteStore.getState().setMuted(false);
    }
    soundRef.current = true;
    setSoundOn(true);
    el.muted = false;
    if (el.paused) {
      stopped.current = false;
      ensureSource();
      void el.play().catch(() => undefined);
    }
  }, [ensureSource]);

  /** "Go live": starts the stream with its sound. */
  const goLive = useCallback(() => {
    const el = video.current;
    if (!el) return;
    audio.blip("click");
    if (useSiteStore.getState().muted) {
      audio.unlock();
      useSiteStore.getState().setMuted(false);
    }
    soundRef.current = true;
    setSoundOn(true);
    el.muted = false;
    stopped.current = false;
    ensureSource();
    void el.play().catch(() => undefined);
  }, [ensureSource]);

  // How many comments have arrived at the video's own clock. It is counted on every frame while
  // the stream plays and on every seek, so a line shows at the second it was sent, and the
  // component only renders again when the count changes.
  const [seen, setSeen] = useState(0);
  const countSeen = useCallback((t: number) => {
    let n = 0;
    while (n < STREAM_COMMENTS.length && (STREAM_COMMENTS[n]?.t ?? Infinity) <= t) n++;
    return n;
  }, []);

  const onTime = useCallback(() => {
    const el = video.current;
    if (!el) return;
    // a quarter of a second is fine for the clock
    setTime((prev) => (Math.abs(prev - el.currentTime) < 0.25 ? prev : el.currentTime));
    setSeen(countSeen(el.currentTime));
  }, [countSeen]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const el = video.current;
      if (el) setSeen(countSeen(el.currentTime));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [playing, countSeen]);

  const arrived = useMemo(() => STREAM_COMMENTS.slice(0, seen), [seen]);
  const lines = arrived.slice(-CHAT_SHOWN);

  useEffect(() => {
    const list = chatRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [arrived.length]);

  const progress = info.duration > 0 ? time / info.duration : 0;

  return (
    <section
      id="stream"
      className={styles.stream}
      data-theme="storm"
      data-live={playing}
      aria-labelledby="stream-title"
    >
      <div className={styles.room} aria-hidden="true">
        <span className={styles.foam} />
        <span className={styles.ring} />
        <span className={styles.ringGlow} />
        <span className={styles.neon}>Guinevere</span>
        <span className={styles.floor} />
      </div>

      <header className={styles.head}>
        <p className={styles.eyebrow}>
          <b>05</b>
          <i />
          <span>On air</span>
        </p>
        <h2 id="stream-title" className={styles.title}>
          Livestream
          <em>Challenge</em>
        </h2>
        <ul className={styles.tags} aria-label="Stream tags">
          {TAGS.map((t) => (
            <li key={t}>#{t}</li>
          ))}
        </ul>
      </header>

      <div className={styles.desk}>
        <div className={styles.stage}>
          <div ref={frame} className={styles.frame}>
            <div className={styles.picture}>
              {/* The file is given to the video when it is near the screen (`useVideoSlot`). */}
              <video
                ref={video}
                className={styles.video}
                poster={info.poster}
                muted
                playsInline
                onPlay={(e) => {
                  setPlaying(true);
                  duck(!e.currentTarget.muted);
                }}
                onVolumeChange={(e) => {
                  duck(!e.currentTarget.paused && !e.currentTarget.muted);
                }}
                onPause={() => {
                  setPlaying(false);
                  duck(false);
                }}
                onEnded={() => {
                  setPlaying(false);
                  duck(false);
                }}
                onTimeUpdate={onTime}
                onSeeked={onTime}
                tabIndex={-1}
              />
              <span className={styles.vignette} aria-hidden="true" />
            </div>

            <div className={styles.hud} aria-hidden="true">
              <span className={styles.badge} data-on={playing}>
                <i />
                {playing ? "Live replay" : "Replay"}
              </span>
              <span className={styles.up}>
                <small>Streamed</small>
                {clock(time)}
              </span>
            </div>

            {!playing && time < 1 ? (
              <button type="button" className={styles.start} onClick={goLive}>
                <span className={styles.startIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="26" height="26">
                    <path d="M8 5v14l11-7z" fill="currentColor" />
                  </svg>
                </span>
                <span>Go live</span>
              </button>
            ) : null}

            {playing && silent ? (
              <button type="button" className={styles.soundChip} onClick={toggleSound}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 010 6" fill="currentColor" />
                </svg>
                <span>Tap for sound</span>
              </button>
            ) : null}
          </div>

          <div className={styles.controls}>
            <button
              type="button"
              className={styles.play}
              onClick={toggle}
              aria-label={playing ? "Pause the stream" : "Play the stream"}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                {playing ? (
                  <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
                ) : (
                  <path d="M8 5v14l11-7z" fill="currentColor" />
                )}
              </svg>
            </button>
            <input
              className={styles.scrub}
              type="range"
              min={0}
              max={Math.floor(info.duration)}
              step={1}
              value={Math.floor(time)}
              style={{ ["--p" as string]: `${progress * 100}%` }}
              onChange={(e) => {
                const el = video.current;
                if (el) el.currentTime = Number(e.target.value);
                setTime(Number(e.target.value));
              }}
              aria-label="Position in the stream"
            />
            <span className={styles.clock}>
              {clock(time)} / {clock(info.duration)}
            </span>
            <button
              type="button"
              className={styles.play}
              onClick={toggleSound}
              aria-pressed={!silent}
              aria-label={silent ? "Turn the stream's sound on" : "Turn the stream's sound off"}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                {silent ? (
                  <path d="M4 9v6h4l5 4V5L8 9zM16 9l5 6M21 9l-5 6" fill="currentColor" />
                ) : (
                  <path
                    d="M4 9v6h4l5 4V5L8 9zM16 8a5 5 0 010 8M18.5 5.5a9 9 0 010 13"
                    fill="currentColor"
                  />
                )}
              </svg>
            </button>
            <PlayerButton
              video={videoFor("live-guin", "Guinevere, live from her room")}
              className={styles.full}
              label="Open the stream in the player"
              onOpen={() => {
                video.current?.pause();
              }}
            >
              Player
            </PlayerButton>
          </div>
        </div>

        <aside className={styles.chat} aria-label="Chat, the comments of the stream">
          <p className={styles.panelHead}>
            <span>Chat</span>
          </p>
          <ol ref={chatRef} className={styles.lines}>
            {lines.map((c) => (
              <li key={c.t} className={styles.line}>
                {c.text}
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </section>
  );
}
