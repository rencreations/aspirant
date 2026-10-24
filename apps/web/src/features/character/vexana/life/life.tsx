"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatTime } from "@/components/video-player/player-math";
import { asset } from "@/lib/asset";
import { useInView, useReducedMotion } from "@/lib/hooks";

import type { VideoName } from "../media";
import { videoInfo } from "../shared/info";
import { PlayerButton, videoFor } from "../shared/player-button";
import styles from "./life.module.css";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

type Kind = "Films" | "Lives" | "Making" | "Shorts";

interface Shelved {
  name: VideoName;
  title: string;
  kind: Kind;
  note: string;
}

/** Every video of the page that no other section uses. */
const SHELF: readonly Shelved[] = [
  { name: "relink", title: "Relink", kind: "Films", note: "The Ender form, in motion." },
  {
    name: "interactive-drama",
    title: "Interactive drama",
    kind: "Films",
    note: "A scene at the Academy, told as a visual novel.",
  },
  {
    name: "comic",
    title: "The comic, in English",
    kind: "Films",
    note: "The comic from the Comic section, voiced in English.",
  },
  {
    name: "live-guin",
    title: "Guinevere, live",
    kind: "Lives",
    note: "Her partner's room, left running.",
  },
  {
    name: "3d-process",
    title: "Making the 3D model",
    kind: "Making",
    note: "How the model was built, in seventeen seconds.",
  },
  { name: "heart-dance", title: "Heart dance", kind: "Shorts", note: "Both of them, in step." },
];

const KINDS: ReadonlyArray<"All" | Kind> = ["All", "Films", "Lives", "Making", "Shorts"];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Vexana's daily life. A sky that goes from afternoon to night as you scroll carries two scenes: the
 * afternoon room (a long, quiet live stream) and the night (her asleep). Under it, a film strip holds
 * every other video of the page, with a tab for each kind. Nothing here plays by itself: a card opens
 * the site's player, and the long videos stream, they are not loaded whole.
 */
export function Life() {
  const reduced = useReducedMotion();
  const days = useRef<HTMLDivElement>(null);
  const night = useRef<HTMLDivElement>(null);
  const stars = useRef<HTMLDivElement>(null);
  const sun = useRef<HTMLDivElement>(null);
  const moon = useRef<HTMLDivElement>(null);
  const dayScene = useRef<HTMLElement>(null);
  const nightScene = useRef<HTMLElement>(null);
  const dayIn = useInView(dayScene, { threshold: 0.25, once: true });
  const nightIn = useInView(nightScene, { threshold: 0.25, once: true });
  const [kind, setKind] = useState<"All" | Kind>("All");

  useEffect(() => {
    const root = days.current;
    if (!root) return;
    const trigger = ScrollTrigger.create({
      trigger: root,
      start: "top bottom",
      end: "bottom top",
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = self.progress;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const dark = smooth(0.3, 0.72, p);
        if (night.current) night.current.style.opacity = dark.toFixed(3);
        if (stars.current) stars.current.style.opacity = smooth(0.45, 0.85, p).toFixed(3);
        if (sun.current) {
          const x = w * (0.12 + 0.5 * p);
          const y = h * (0.18 + 0.9 * smooth(0.1, 0.75, p));
          sun.current.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        }
        if (moon.current) {
          const m = smooth(0.4, 0.95, p);
          const x = w * (0.92 - 0.42 * m);
          const y = h * (1.1 - 0.9 * m);
          moon.current.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        }
      },
    });
    return () => {
      trigger.kill();
    };
  }, []);

  const items = useMemo(() => SHELF.map((s) => ({ ...s, info: videoInfo(s.name) })), []);
  const live = videoInfo("live-vexana");
  const sleeping = videoInfo("sleeping");

  return (
    <section id="life" className={styles.life} data-theme="storm" aria-labelledby="life-title">
      <div ref={days} className={styles.days}>
        <div className={styles.skyWrap} aria-hidden="true">
          <div className={styles.sky}>
            <div className={styles.dusk} />
            <div ref={night} className={styles.night} />
            <div ref={stars} className={styles.stars} />
            <div ref={sun} className={styles.sun} />
            <div ref={moon} className={styles.moon} />
          </div>
        </div>

        <header className={styles.head}>
          <p className={styles.kicker}>Daily life</p>
          <h2 id="life-title" className={styles.title}>
            <span>An ordinary</span>
            <span className={styles.serif}>day with her.</span>
          </h2>
        </header>

        <article ref={dayScene} className={styles.scene} data-in={dayIn} data-reduced={reduced}>
          <div className={styles.sceneText}>
            <p className={styles.when}>
              <b>15:20</b> Afternoon
            </p>
            <h3>The study hour</h3>
            <p>
              A quiet room, the city outside the glass, a lamp with a green shade. Leave it running
              while you work. It is {formatTime(live.duration)} long, and nothing happens, which is
              the point.
            </p>
          </div>
          <PlayerButton
            className={`${styles.window} ${styles.landscape}`}
            label="Play the study hour"
            video={videoFor("live-vexana", "Vexana, the study hour")}
          >
            {/* Plain <img>: static export. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset(live.poster)}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
            />
            <span className={styles.bars} aria-hidden="true" />
            <span className={styles.go} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </span>
            <span className={styles.len}>{formatTime(live.duration)}</span>
          </PlayerButton>
        </article>

        <article
          ref={nightScene}
          className={`${styles.scene} ${styles.reverse}`}
          data-in={nightIn}
          data-reduced={reduced}
        >
          <PlayerButton
            className={`${styles.window} ${styles.portrait}`}
            label="Play the night"
            video={videoFor("sleeping", "Vexana, asleep")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset(sleeping.poster)}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
            />
            <span className={styles.go} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </span>
            <span className={styles.len}>{formatTime(sleeping.duration)}</span>
          </PlayerButton>
          <div className={styles.sceneText}>
            <p className={styles.when}>
              <b>02:40</b> Night
            </p>
            <h3>Asleep, for once</h3>
            <p>
              The staff leans by the bed. The worry is switched off, and so is she. Fifty seconds,
              no sound needed.
            </p>
          </div>
        </article>
      </div>

      <div className={styles.shelf}>
        <div className={styles.shelfHead}>
          <h3 className={styles.shelfTitle}>
            The rest of <span className={styles.serif}>the reel</span>
          </h3>
          <div className={styles.tabs} role="tablist" aria-label="Kind of video">
            {KINDS.map((k) => {
              const count = k === "All" ? items.length : items.filter((i) => i.kind === k).length;
              if (count === 0) return null;
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={kind === k}
                  className={styles.tab}
                  onClick={() => {
                    setKind(k);
                  }}
                >
                  {k} <i>{count}</i>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.rail}>
          <ul key={kind} className={styles.band}>
            {items
              .filter((i) => kind === "All" || i.kind === kind)
              .map((i, n) => (
                <li key={i.name} className={styles.cell} style={{ ["--n" as string]: n }}>
                  <PlayerButton
                    className={styles.card}
                    label={`Play ${i.title}`}
                    video={videoFor(i.name, i.title)}
                  >
                    <span className={styles.frame} style={{ aspectRatio: String(i.info.ratio) }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset(i.info.poster)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                      <span className={styles.go} aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="18" height="18">
                          <path d="M8 5v14l11-7z" fill="currentColor" />
                        </svg>
                      </span>
                    </span>
                    <span className={styles.cap}>
                      <b>{i.title}</b>
                      <small>
                        {i.kind} <i>{formatTime(i.info.duration)}</i>
                      </small>
                      <em>{i.note}</em>
                    </span>
                  </PlayerButton>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
