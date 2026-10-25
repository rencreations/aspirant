"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { audio } from "@/lib/audio";
import { useInView, useReducedMotion } from "@/lib/hooks";

import { videoInfo } from "../shared/info";
import { PlayerButton, videoFor } from "../shared/player-button";
import { FPS, PASSES, SHADES, TOOLS, passAt, type Shade } from "./process-data";
import styles from "./process.module.css";

const ICONS: Record<(typeof TOOLS)[number], string> = {
  Select: "M5 3l13 8-6 1.5L9 19z",
  Move: "M12 3l3 3h-2v4h4V8l3 3-3 3v-2h-4v4h2l-3 3-3-3h2v-4H7v2l-3-3 3-3v2h4V6H9z",
  Rotate: "M12 5a7 7 0 106.7 5h-2.1A5 5 0 1112 7v3l4-4-4-4z",
  Scale: "M4 4h7v2H7.4l4.3 4.3-1.4 1.4L6 7.4V11H4zm16 16h-7v-2h3.6l-4.3-4.3 1.4-1.4 4.3 4.3V13h2z",
  Camera: "M4 7h3l2-2h6l2 2h3v12H4zm8 3a3.5 3.5 0 100 7 3.5 3.5 0 000-7z",
};

const frame = (t: number) => String(Math.round(t * FPS)).padStart(3, "0");

/**
 * 07, the 3D process. The model's making-of clip in a modeller's workspace: a viewport with a
 * grid, an axis gizmo and shading modes, a toolbar, an outliner of the three passes the clip is
 * made of (clay, render, effects), a properties panel and a timeline that really scrubs the video.
 * The clip plays muted and loops while it is on screen. The shading modes and the figures in the
 * panel are decoration written for the page.
 */
export function Process() {
  const info = useMemo(() => videoInfo("3d-process"), []);
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const head = useRef<HTMLSpanElement>(null);
  const readout = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(root, { threshold: 0.25 });
  const [shade, setShade] = useState<Shade>("render");
  const [tool, setTool] = useState<(typeof TOOLS)[number]>("Rotate");
  const [playing, setPlaying] = useState(false);
  const [held, setHeld] = useState(false);
  const wanted = useRef(true);
  const [pass, setPass] = useState(PASSES[0]!);

  const paint = useCallback(() => {
    const el = video.current;
    if (!el) return;
    const t = el.currentTime;
    if (head.current) head.current.style.transform = `translateX(${(t / info.duration) * 100}%)`;
    if (readout.current) readout.current.textContent = `${frame(t)} / ${frame(info.duration)}`;
    const p = passAt(t);
    setPass((prev) => (prev.id === p.id ? prev : p));
  }, [info.duration]);

  // The picture plays while it is on screen, and stops when it is not (unless the visitor stopped it).
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (inView && wanted.current && !reduced && !held) void el.play().catch(() => undefined);
    else el.pause();
  }, [inView, reduced, held]);

  // The playhead is moved a frame at a time, on this one element, while the clip plays.
  useEffect(() => {
    if (!playing || !inView) return;
    let id = 0;
    const tick = () => {
      paint();
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(id);
    };
  }, [playing, inView, paint]);

  const seek = useCallback(
    (t: number) => {
      const el = video.current;
      if (!el) return;
      el.currentTime = Math.max(0, Math.min(info.duration - 0.05, t));
      paint();
    },
    [info.duration, paint],
  );

  const toggle = useCallback(() => {
    const el = video.current;
    if (!el) return;
    audio.blip("click");
    if (el.paused) {
      wanted.current = true;
      void el.play().catch(() => undefined);
    } else {
      wanted.current = false;
      el.pause();
    }
  }, []);

  return (
    <section
      ref={root}
      id="process"
      className={styles.process}
      data-theme="storm"
      aria-labelledby="process-title"
    >
      <header className={styles.head}>
        <p className={styles.eyebrow}>
          <b>07</b>
          <i />
          <span>Behind the model</span>
        </p>
        <h2 id="process-title" className={styles.title}>
          <span>3D</span> process
        </h2>
        <p className={styles.lede}>
          The plain clay model, the painted render and the effects on top. Drag the timeline to move
          through them.
        </p>
      </header>

      <div className={styles.window}>
        <div className={styles.titlebar}>
          <span className={styles.dots} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <b>vexana_ender_model</b>
          <span className={styles.menus} aria-hidden="true">
            <span>File</span>
            <span>Edit</span>
            <span>Render</span>
            <span>Window</span>
          </span>
          <span className={styles.rec} data-on={playing} aria-hidden="true">
            <i />
            {playing ? "Playing" : "Paused"}
          </span>
        </div>

        <div className={styles.body}>
          <div className={styles.tools} role="group" aria-label="Tools">
            {TOOLS.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tool === t}
                aria-label={t}
                title={t}
                onClick={() => {
                  setTool(t);
                  audio.blip("hover");
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d={ICONS[t]} fill="currentColor" />
                </svg>
              </button>
            ))}
          </div>

          <div className={styles.viewport} data-shade={shade}>
            <span className={styles.floor} aria-hidden="true" />
            <div className={styles.shades} role="group" aria-label="Shading">
              {SHADES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={shade === s.id}
                  onClick={() => {
                    setShade(s.id);
                    audio.blip("click");
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className={styles.cam}>
              <video
                ref={video}
                className={styles.video}
                src={info.src}
                poster={info.poster}
                muted
                loop
                playsInline
                preload="metadata"
                onPlay={() => {
                  setPlaying(true);
                }}
                onPause={() => {
                  setPlaying(false);
                  paint();
                }}
                onSeeked={paint}
                tabIndex={-1}
              />
              <span className={styles.wire} aria-hidden="true">
                <svg width="100%" height="100%">
                  <defs>
                    <pattern id="vx-mesh" width="34" height="30" patternUnits="userSpaceOnUse">
                      <path
                        d="M0 15h34M0 0l17 30M34 0L17 30M17 0v30"
                        stroke="rgb(255 255 255 / 0.7)"
                        strokeWidth="0.8"
                        fill="none"
                      />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#vx-mesh)" />
                </svg>
              </span>
              <span className={styles.clay} aria-hidden="true" />
              <span className={styles.uv} aria-hidden="true" />
              <span className={styles.brackets} aria-hidden="true" />
            </div>

            <svg className={styles.gizmo} viewBox="0 0 64 64" aria-hidden="true">
              <g>
                <line x1="32" y1="32" x2="54" y2="40" stroke="#ff5c7a" strokeWidth="2" />
                <line x1="32" y1="32" x2="32" y2="8" stroke="#7bdc8a" strokeWidth="2" />
                <line x1="32" y1="32" x2="14" y2="48" stroke="#6aa6ff" strokeWidth="2" />
                <circle cx="54" cy="40" r="5" fill="#ff5c7a" />
                <circle cx="32" cy="8" r="5" fill="#7bdc8a" />
                <circle cx="14" cy="48" r="5" fill="#6aa6ff" />
                <circle cx="32" cy="32" r="3" fill="#fff" />
              </g>
            </svg>

            <p className={styles.mode}>
              <span>{SHADES.find((s) => s.id === shade)?.label} view</span>
              <span>Tool: {tool}</span>
            </p>
          </div>

          <aside className={styles.side} aria-label="Outliner and properties">
            <p className={styles.sideHead}>Outliner</p>
            <ul className={styles.outliner}>
              {PASSES.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    data-id={p.id}
                    aria-current={pass.id === p.id}
                    onClick={() => {
                      seek(p.start);
                      audio.blip("click");
                    }}
                  >
                    <i aria-hidden="true" />
                    <span>{p.label}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className={styles.note}>{pass.note}</p>

            <p className={styles.sideHead}>Properties</p>
            <dl className={styles.props}>
              {pass.stats.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
              <div>
                <dt>Picture</dt>
                <dd>
                  {Math.round(info.height * info.ratio)} x {info.height}
                </dd>
              </div>
              <div>
                <dt>Rate</dt>
                <dd>{FPS} fps</dd>
              </div>
            </dl>
            <p className={styles.fine}>Figures other than the picture are illustrative.</p>

            <PlayerButton
              video={videoFor("3d-process", "3D process")}
              className={styles.full}
              label="Watch the 3D process in the player, with sound"
              onOpen={() => {
                video.current?.pause();
              }}
            >
              Full player, with sound
            </PlayerButton>
          </aside>
        </div>

        <div className={styles.timeline}>
          <button
            type="button"
            className={styles.play}
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              {playing ? (
                <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
              ) : (
                <path d="M8 5v14l11-7z" fill="currentColor" />
              )}
            </svg>
          </button>
          <div className={styles.tracks}>
            {PASSES.map((p) => (
              <div key={p.id} className={styles.track} data-id={p.id}>
                <small>{p.label}</small>
                <span>
                  {p.ranges.map(([a, b]) => (
                    <i
                      key={a}
                      style={{
                        left: `${(a / info.duration) * 100}%`,
                        width: `${((b - a) / info.duration) * 100}%`,
                      }}
                    />
                  ))}
                </span>
              </div>
            ))}
            <span className={styles.playhead} ref={head} aria-hidden="true" />
            <input
              className={styles.scrub}
              type="range"
              min={0}
              max={info.duration}
              step={1 / FPS}
              defaultValue={0}
              aria-label="Position in the clip"
              onPointerDown={() => {
                setHeld(true);
              }}
              onPointerUp={() => {
                setHeld(false);
              }}
              onPointerCancel={() => {
                setHeld(false);
              }}
              onBlur={() => {
                setHeld(false);
              }}
              onChange={(e) => {
                seek(Number(e.target.value));
              }}
            />
          </div>
          <code ref={readout} className={styles.frame}>
            000 / {frame(info.duration)}
          </code>
        </div>
      </div>
    </section>
  );
}
