"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { audio } from "@/lib/audio";
import { useInView } from "@/lib/hooks";
import { useSiteStore } from "@/lib/stores";

import { PlayerButton, videoFor } from "../shared/player-button";
import { videoInfo } from "../shared/info";
import { ALERTS, ALERT_SECONDS, CHAT, SCENES, TAGS } from "./stream-data";
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
const CHAT_SHOWN = 7;

/**
 * 05, the stream. Her daily life stream (a vertical livestream) in a studio of its own: an acoustic wall,
 * a ring light, an ON AIR sign, a stage with the picture, a mixer and a chat. The chat and the
 * alerts are a mock written for the page and tied to the video's clock. The sliders are real: one
 * is the volume and one is the warm light over the picture. The scene buttons reframe the picture.
 * The video streams (nothing is fetched until it plays), and the site's player opens it large.
 */
export function Stream() {
  const info = useMemo(() => videoInfo("live-vexana"), []);
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const chatRef = useRef<HTMLOListElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [scene, setScene] = useState(0);
  const [lamp, setLamp] = useState(0.4);
  const [volume, setVolume] = useState(0.7);
  const inView = useInView(root, { rootMargin: "0px", threshold: 0.15 });

  // The site's sound button decides whether the stream has sound at all.
  const [siteMuted, setSiteMuted] = useState(() => useSiteStore.getState().muted);
  useEffect(() => useSiteStore.subscribe((s) => setSiteMuted(s.muted)), []);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    el.volume = volume;
    el.muted = siteMuted;
  }, [volume, siteMuted]);

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
    setTime((prev) => (Math.floor(prev) === Math.floor(el.currentTime) ? prev : el.currentTime));
  }, []);

  const alert = ALERTS.find((a) => time >= a.t && time < a.t + ALERT_SECONDS);
  const arrived = CHAT.filter((c) => c.t <= time);
  const lines = arrived.slice(-CHAT_SHOWN);

  useEffect(() => {
    const list = chatRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [arrived.length]);

  const s = SCENES[scene] ?? SCENES[0]!;
  const heard = !siteMuted && volume > 0;
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
          Live from
          <em> her room.</em>
        </h2>
        <p className={styles.lede}>
          Vexana's own livestream: she greets the chat, reads, plays a few rounds of darts and takes
          her time. {clock(info.duration)} from her room, replayed in a studio built for it. Press
          play and take a seat.
        </p>
        <ul className={styles.tags} aria-label="Stream tags">
          {TAGS.map((t) => (
            <li key={t}>#{t}</li>
          ))}
        </ul>
      </header>

      <div className={styles.desk}>
        <aside className={styles.rack} aria-label="Studio mixer">
          <p className={styles.panelHead}>
            <span>Mixer</span>
            <i data-on={playing} />
          </p>
          <label className={styles.fader}>
            <span>
              Volume <b>{Math.round(volume * 100)}</b>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
              }}
              aria-label="Stream volume"
            />
          </label>
          <label className={styles.fader}>
            <span>
              Warmth <b>{Math.round(lamp * 100)}</b>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={lamp}
              onChange={(e) => {
                setLamp(Number(e.target.value));
              }}
              aria-label="Warm light over the picture"
            />
          </label>
          <div className={styles.vu} data-on={playing && heard} aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} style={{ ["--i" as string]: i }} />
            ))}
          </div>
          <p className={styles.note}>
            {siteMuted
              ? "The site's sound button is off, so the stream is silent."
              : "The music steps aside while the stream plays."}
          </p>
        </aside>

        <div className={styles.stage}>
          <div className={styles.frame}>
            <div className={styles.picture}>
              <div
                className={styles.cam}
                style={{
                  transform: `scale(${s.scale})`,
                  transformOrigin: `${s.x}% ${s.y}%`,
                }}
              >
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
              </div>
              <span className={styles.lamp} style={{ opacity: lamp * 0.55 }} aria-hidden="true" />
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

            {alert ? (
              <div key={alert.t} className={styles.alert} role="status">
                <small>{alert.kicker}</small>
                {alert.text}
              </div>
            ) : null}

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

          <div className={styles.scenes} role="group" aria-label="Camera scenes">
            {SCENES.map((sc, i) => (
              <button
                key={sc.id}
                type="button"
                className={styles.scene}
                aria-pressed={scene === i}
                onClick={() => {
                  audio.blip("click");
                  setScene(i);
                }}
              >
                <b>{i + 1}</b>
                {sc.label}
              </button>
            ))}
          </div>
        </div>

        <aside className={styles.chat} aria-label="Chat, a mock written for this page">
          <p className={styles.panelHead}>
            <span>Chat</span>
            <em>mock</em>
          </p>
          <ol ref={chatRef} className={styles.lines}>
            {lines.map((c, i) => (
              <li key={`${c.t}-${c.user}-${i}`} className={styles.line}>
                <b style={{ color: `hsl(${c.hue} 80% 76%)` }}>{c.user}</b>
                <span>{c.text}</span>
              </li>
            ))}
          </ol>
          <p className={styles.say} aria-hidden="true">
            Chat is a mock. Nobody is typing.
          </p>
        </aside>
      </div>
    </section>
  );
}
