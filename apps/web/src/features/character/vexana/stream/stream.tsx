"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { audio } from "@/lib/audio";
import { useInView } from "@/lib/hooks";
import { useSiteStore } from "@/lib/stores";

import { PlayerButton, videoFor } from "../shared/player-button";
import { videoInfo } from "../shared/info";
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
 * same comments, read from the video by `scripts/vexana/comments.py`, each at the second it
 * entered (`comments.generated.ts`). Nothing here is invented. The video streams (nothing is
 * fetched until it plays), and the site's player opens it large.
 */
export function Stream() {
  const info = useMemo(() => videoInfo("live-vexana"), []);
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const chatRef = useRef<HTMLOListElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const inView = useInView(root, { rootMargin: "0px", threshold: 0.15 });

  // The site's sound button decides whether the stream has sound at all.
  const [siteMuted, setSiteMuted] = useState(() => useSiteStore.getState().muted);
  useEffect(() => useSiteStore.subscribe((s) => setSiteMuted(s.muted)), []);

  useEffect(() => {
    const el = video.current;
    if (el) el.muted = siteMuted;
  }, [siteMuted]);

  const duck = useMusicDuck();

  useEffect(() => {
    const el = video.current;
    if (el && !inView && !el.paused) el.pause();
  }, [inView]);

  const toggle = useCallback(() => {
    const el = video.current;
    if (!el) return;
    audio.blip("click");
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  }, []);

  const onTime = useCallback(() => {
    const el = video.current;
    if (!el) return;
    // a quarter of a second is fine for the clock and the chat
    setTime((prev) => (Math.abs(prev - el.currentTime) < 0.25 ? prev : el.currentTime));
  }, []);

  const arrived = useMemo(() => STREAM_COMMENTS.filter((c) => c.t <= time), [time]);
  const lines = arrived.slice(-CHAT_SHOWN);

  useEffect(() => {
    const list = chatRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [arrived.length]);

  const progress = info.duration > 0 ? time / info.duration : 0;

  return (
    <section
      ref={root}
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
        <span className={styles.neon}>Vexana</span>
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
          <em> Challenge</em>
        </h2>
        <ul className={styles.tags} aria-label="Stream tags">
          {TAGS.map((t) => (
            <li key={t}>#{t}</li>
          ))}
        </ul>
      </header>

      <div className={styles.desk}>
        <div className={styles.stage}>
          <div className={styles.frame}>
            <div className={styles.picture}>
              {/* The stream is fetched when it plays, not before. */}
              <video
                ref={video}
                className={styles.video}
                src={info.src}
                poster={info.poster}
                preload="none"
                playsInline
                onPlay={() => {
                  setPlaying(true);
                  duck(!useSiteStore.getState().muted);
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
              <button type="button" className={styles.start} onClick={toggle}>
                <span className={styles.startIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="26" height="26">
                    <path d="M8 5v14l11-7z" fill="currentColor" />
                  </svg>
                </span>
                <span>Go live</span>
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
            <PlayerButton
              video={videoFor("live-vexana", "Vexana, live from her room")}
              className={styles.full}
              label="Open the stream in the player"
              onOpen={() => {
                video.current?.pause();
              }}
            >
              Player
            </PlayerButton>
          </div>
          {siteMuted ? (
            <p className={styles.note}>The site's sound button is off, so the stream is silent.</p>
          ) : null}
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
