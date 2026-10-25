"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { mediaUrl } from "@/lib/media-store";
import { audio } from "@/lib/audio";
import { useInView } from "@/lib/hooks";
import { useSiteStore } from "@/lib/stores";

import { videoInfo } from "../shared/info";
import { PlayerButton, videoFor } from "../shared/player-button";
import { useMusicDuck } from "../stream/use-duck";
import {
  ACHIEVEMENTS,
  CONTINUE_SECONDS,
  LEVELS,
  POINTS_PER_LEVEL,
  POINTS_PER_SECOND,
  type Achievement,
} from "./drama-data";
import styles from "./drama.module.css";

type Mode = "title" | "play" | "pause" | "levels" | "clear";

const levelAt = (t: number) => LEVELS.reduce((found, l, i) => (l.at <= t ? i : found), 0);

const pad = (n: number, w = 6) => String(Math.max(0, Math.floor(n))).padStart(w, "0");

/**
 * 06, the game. The visual novel scene as if it were a game: a title screen with PRESS START, a
 * level select (each level is a moment of the video, jumped to by its second), a HUD with a hope
 * bar, a score and a quest log, a pause menu, achievements, and a "continue?" countdown at the end.
 * It covers most of the screen. Nothing plays until the visitor presses start, and then it plays
 * with sound (the page's music steps aside).
 */
export function Drama() {
  const info = useMemo(() => videoInfo("interactive-drama"), []);
  const root = useRef<HTMLElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const loaded = useRef(false);
  const [mode, setMode] = useState<Mode>("title");
  const [time, setTime] = useState(0);
  const [best, setBest] = useState(0);
  const [scan, setScan] = useState(true);
  const [fx, setFx] = useState(true);
  const [log, setLog] = useState(true);
  const [toast, setToast] = useState<Achievement | null>(null);
  const [count, setCount] = useState(CONTINUE_SECONDS);
  const [siteMuted, setSiteMuted] = useState(() => useSiteStore.getState().muted);
  const unlocked = useRef(new Set<string>());
  // The screen powers on the first time the section is seen.
  const powered = useInView(root, { threshold: 0.2, once: true });
  const modeRef = useRef<Mode>("title");
  const remaining = useRef(CONTINUE_SECONDS);
  const duck = useMusicDuck();

  useEffect(() => useSiteStore.subscribe((s) => setSiteMuted(s.muted)), []);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const sfx = useCallback(
    (kind: Parameters<typeof audio.blip>[0]) => {
      if (fx) audio.blip(kind);
    },
    [fx],
  );

  const unlock = useCallback((a: Achievement) => {
    if (unlocked.current.has(a.id)) return;
    unlocked.current.add(a.id);
    setToast(a);
    audio.blip("star");
    window.setTimeout(() => {
      setToast((t) => (t?.id === a.id ? null : t));
    }, 4200);
  }, []);

  const level = levelAt(time);
  const score = Math.floor(time * POINTS_PER_SECOND) + best * POINTS_PER_LEVEL;
  const hope = Math.min(1, time / info.duration);

  // Where the focus goes when the screen changes: the first button of a menu, or the screen itself.
  useEffect(() => {
    const el = screen.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>("[data-menu] button");
    if (mode === "play") el.focus({ preventScroll: true });
    else if (first) first.focus({ preventScroll: true });
  }, [mode]);

  const begin = useCallback(
    (at = 0) => {
      const el = video.current;
      if (!el) return;
      if (!loaded.current) {
        el.src = mediaUrl(info.src);
        loaded.current = true;
      }
      el.muted = useSiteStore.getState().muted;
      el.volume = 0.9;
      el.currentTime = at;
      setTime(at);
      setBest(at === 0 ? 0 : levelAt(at));
      setMode("play");
      sfx("confirm");
      unlock(ACHIEVEMENTS.start!);
      void el.play().catch(() => undefined);
    },
    [info.src, sfx, unlock],
  );

  const pause = useCallback(() => {
    video.current?.pause();
    setMode("pause");
    sfx("click");
  }, [sfx]);

  const resume = useCallback(() => {
    setMode("play");
    sfx("click");
    void video.current?.play().catch(() => undefined);
  }, [sfx]);

  // The full player takes over: the game's own picture and sound stop first.
  const openFull = useCallback(() => {
    if (modeRef.current === "play") {
      video.current?.pause();
      setMode("pause");
    }
    sfx("confirm");
  }, [sfx]);

  const toTitle = useCallback(() => {
    const el = video.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setTime(0);
    setBest(0);
    setMode("title");
    sfx("whoosh");
  }, [sfx]);

  const jump = useCallback(
    (i: number) => {
      const target = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, i))];
      if (target) begin(target.at);
    },
    [begin],
  );

  // After the scene: a "continue?" countdown back to the title.
  useEffect(() => {
    if (mode !== "clear") return;
    remaining.current = CONTINUE_SECONDS;
    const id = window.setInterval(() => {
      remaining.current -= 1;
      if (remaining.current < 0) {
        window.clearInterval(id);
        toTitle();
      } else setCount(remaining.current);
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [mode, toTitle]);

  // The picture stops when the section leaves the screen.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry && !entry.isIntersecting && modeRef.current === "play") {
          video.current?.pause();
          setMode("pause");
        }
      },
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, []);

  const onKey = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const menu = screen.current?.querySelectorAll<HTMLElement>("[data-menu] button");
      if (menu && menu.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        const items = Array.from(menu);
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next = (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
        sfx("hover");
        e.preventDefault();
        return;
      }
      if (e.key === "Escape") {
        if (mode === "play") pause();
        else if (mode === "pause") resume();
        else if (mode === "levels") setMode(time > 0 ? "pause" : "title");
        e.preventDefault();
        return;
      }
      if (mode !== "play") return;
      if (e.key === "ArrowRight") jump(level + 1);
      else if (e.key === "ArrowLeft") jump(time - (LEVELS[level]?.at ?? 0) > 2 ? level : level - 1);
      else if (e.key === "l" || e.key === "L") {
        video.current?.pause();
        setMode("levels");
      } else if (e.key === " " && e.target === e.currentTarget) pause();
      else return;
      e.preventDefault();
    },
    [jump, level, mode, pause, resume, sfx, time],
  );

  const current = LEVELS[level] ?? LEVELS[0]!;
  const onTitle = mode === "title";
  const menuOpen = mode === "pause" || mode === "levels" || mode === "clear" || onTitle;

  return (
    <section
      ref={root}
      id="drama"
      className={styles.drama}
      data-theme="storm"
      data-mode={mode}
      aria-labelledby="drama-title"
    >
      <div className={styles.bg} aria-hidden="true">
        <span className={styles.grid} />
        {Array.from({ length: 14 }, (_, i) => (
          <span
            key={i}
            className={styles.pixel}
            style={{
              left: `${(i * 37 + 8) % 96}%`,
              top: `${(i * 53 + 12) % 86}%`,
              animationDelay: `${(i % 5) * -0.7}s`,
            }}
          />
        ))}
      </div>

      <header className={styles.top}>
        <p className={styles.eyebrow}>
          <b>06</b>
          <i />
          <span>Player one</span>
        </p>
        <h2 id="drama-title" className={styles.sr}>
          First day at Selrick, a scene to play
        </h2>
        <div className={styles.topEnd}>
          <p className={styles.max}>
            <span>Top score</span>
            {pad(info.duration * POINTS_PER_SECOND + (LEVELS.length - 1) * POINTS_PER_LEVEL)}
          </p>
          <PlayerButton
            video={videoFor("interactive-drama", "First day at Selrick")}
            label="Play the whole visual novel in full screen, with sound"
            className={styles.fs}
            onOpen={openFull}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="square"
              />
            </svg>
            <span>Full screen</span>
          </PlayerButton>
        </div>
      </header>

      <div className={styles.cab}>
        <div
          ref={screen}
          className={styles.screen}
          data-powered={powered}
          data-scan={scan}
          tabIndex={-1}
          role="group"
          aria-label="Game screen"
          onKeyDown={onKey}
        >
          <video
            ref={video}
            className={styles.video}
            poster={info.poster}
            preload="none"
            playsInline
            muted={siteMuted}
            onTimeUpdate={(e) => {
              const t = e.currentTarget.currentTime;
              setTime((p) => (Math.floor(p * 4) === Math.floor(t * 4) ? p : t));
              const reached = levelAt(t);
              setBest((b) => Math.max(b, reached));
              if (reached >= 4) unlock(ACHIEVEMENTS.badge!);
            }}
            onPlay={() => {
              duck(!useSiteStore.getState().muted);
            }}
            onPause={() => {
              duck(false);
            }}
            onEnded={() => {
              duck(false);
              unlock(ACHIEVEMENTS.clear!);
              setBest(LEVELS.length - 1);
              setCount(CONTINUE_SECONDS);
              setMode("clear");
              audio.blip("confirm");
            }}
            onClick={() => {
              if (mode === "play") pause();
            }}
            tabIndex={-1}
          />
          <span className={styles.scanlines} aria-hidden="true" />

          {mode === "play" || mode === "pause" ? (
            <div className={styles.hud}>
              <div className={styles.bar}>
                <span className={styles.chip}>
                  <b>LV {level + 1}</b>/{LEVELS.length} {current.name}
                </span>
                <span
                  className={styles.hope}
                  role="img"
                  aria-label={`Hope ${Math.round(hope * 100)} percent`}
                >
                  <small>Hope</small>
                  <span className={styles.hopeTrack}>
                    <span className={styles.hopeFill} style={{ transform: `scaleX(${hope})` }} />
                  </span>
                </span>
                <span className={styles.score}>
                  <small>Score</small>
                  {pad(score)}
                </span>
                <button
                  type="button"
                  className={styles.icon}
                  onClick={mode === "play" ? pause : resume}
                  aria-label={mode === "play" ? "Pause" : "Resume"}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    {mode === "play" ? (
                      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
                    ) : (
                      <path d="M8 5v14l11-7z" fill="currentColor" />
                    )}
                  </svg>
                </button>
              </div>

              {log ? (
                <aside className={styles.quests} aria-label="Quest log">
                  <p>
                    <span>Quest log</span>
                    <button
                      type="button"
                      onClick={() => {
                        setLog(false);
                        sfx("click");
                      }}
                      aria-label="Hide the quest log"
                    >
                      Hide
                    </button>
                  </p>
                  <ol>
                    {LEVELS.map((l, i) => (
                      <li
                        key={l.name}
                        data-state={i < level ? "done" : i === level ? "now" : "todo"}
                      >
                        <i aria-hidden="true">{i < level ? "x" : i === level ? ">" : ""}</i>
                        <span>{i <= best ? l.quest : "? ? ?"}</span>
                      </li>
                    ))}
                  </ol>
                </aside>
              ) : (
                <button
                  type="button"
                  className={styles.logOpen}
                  onClick={() => {
                    setLog(true);
                    sfx("click");
                  }}
                >
                  Quests
                </button>
              )}
            </div>
          ) : null}

          {toast ? (
            <div key={toast.id} className={styles.toast} role="status">
              <span className={styles.trophy} aria-hidden="true" />
              <span>
                <small>Achievement unlocked</small>
                <b>{toast.title}</b>
                {toast.text}
              </span>
            </div>
          ) : null}

          {menuOpen ? (
            <div className={styles.overlay} data-kind={mode}>
              {onTitle ? (
                <>
                  <p className={styles.kicker}>A visual novel scene</p>
                  <p className={styles.logo}>
                    <span>First day</span>
                    <span>at Selrick</span>
                  </p>
                  <p className={styles.press}>Press start</p>
                  <ul className={styles.menu} data-menu>
                    <li>
                      <button type="button" onClick={() => begin(0)}>
                        Start
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setMode("levels");
                          sfx("click");
                        }}
                      >
                        Level select
                      </button>
                    </li>
                    <li>
                      <PlayerButton
                        video={videoFor("interactive-drama", "First day at Selrick")}
                        label="Play the whole visual novel in full screen, with sound"
                        onOpen={openFull}
                      >
                        Full screen
                      </PlayerButton>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setScan((s) => !s);
                          sfx("click");
                        }}
                      >
                        Scanlines <em>{scan ? "on" : "off"}</em>
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setFx((s) => !s);
                          audio.blip("click");
                        }}
                      >
                        Sound fx <em>{fx ? "on" : "off"}</em>
                      </button>
                    </li>
                  </ul>
                </>
              ) : null}

              {mode === "pause" ? (
                <>
                  <p className={styles.heading}>Paused</p>
                  <ul className={styles.menu} data-menu>
                    <li>
                      <button type="button" onClick={resume}>
                        Resume
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setMode("levels");
                          sfx("click");
                        }}
                      >
                        Level select
                      </button>
                    </li>
                    <li>
                      <PlayerButton
                        video={videoFor("interactive-drama", "First day at Selrick")}
                        label="Play the whole visual novel in full screen, with sound"
                        onOpen={openFull}
                      >
                        Full screen
                      </PlayerButton>
                    </li>
                    <li>
                      <button type="button" onClick={toTitle}>
                        Quit to title
                      </button>
                    </li>
                  </ul>
                </>
              ) : null}

              {mode === "levels" ? (
                <>
                  <p className={styles.heading}>Level select</p>
                  <ol className={styles.levels} data-menu>
                    {LEVELS.map((l, i) => (
                      <li key={l.name}>
                        <button type="button" onClick={() => begin(l.at)}>
                          <b>{i + 1}</b>
                          <span>{l.name}</span>
                          <small>{Math.floor(l.at)}s</small>
                        </button>
                      </li>
                    ))}
                    <li className={styles.back}>
                      <button
                        type="button"
                        onClick={() => {
                          setMode(time > 0 ? "pause" : "title");
                          sfx("click");
                        }}
                      >
                        Back
                      </button>
                    </li>
                  </ol>
                </>
              ) : null}

              {mode === "clear" ? (
                <>
                  <p className={styles.heading}>Stage clear</p>
                  <p className={styles.final}>
                    Final score <b>{pad(score)}</b>
                  </p>
                  <p className={styles.count} aria-live="off">
                    Continue? <b>{Math.max(0, count)}</b>
                  </p>
                  <ul className={styles.menu} data-menu>
                    <li>
                      <button type="button" onClick={() => begin(0)}>
                        Play again
                      </button>
                    </li>
                    <li>
                      <button type="button" onClick={toTitle}>
                        Title screen
                      </button>
                    </li>
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={styles.pad} aria-hidden={mode === "title"}>
          <ul className={styles.keys}>
            <li>
              <kbd>Up</kbd>
              <kbd>Down</kbd>
              <span>Menu</span>
            </li>
            <li>
              <kbd>Enter</kbd>
              <span>Pick</span>
            </li>
            <li>
              <kbd>Left</kbd>
              <kbd>Right</kbd>
              <span>Level</span>
            </li>
            <li>
              <kbd>Esc</kbd>
              <span>Pause</span>
            </li>
            <li>
              <kbd>L</kbd>
              <span>Levels</span>
            </li>
          </ul>
          <div className={styles.stages} role="group" aria-label="Levels">
            <span className={styles.rail} aria-hidden="true">
              <span className={styles.railFill} style={{ transform: `scaleX(${hope})` }} />
            </span>
            {LEVELS.map((l, i) => (
              <button
                key={l.name}
                type="button"
                className={styles.tick}
                style={{ left: `${(l.at / info.duration) * 100}%` }}
                data-state={i < level ? "done" : i === level && mode !== "title" ? "now" : "todo"}
                onClick={() => begin(l.at)}
                aria-label={`Level ${i + 1}, ${l.name}`}
              >
                <b>{i + 1}</b>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
