"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { formatTime } from "@/components/video-player/player-math";
import { getCharacter, keyVoiceLines } from "@/content/characters";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useReducedMotion } from "@/lib/hooks";

import { artPath, artThumb, videoPoster, videoFile } from "../media";
import { PlayerButton, videoFor } from "../shared/player-button";
import { videoInfo } from "../shared/info";
import styles from "./guinevere.module.css";
import { useVisiblePlay } from "./use-visible-play";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/** The pair's coupling when they registered (canon: 1.62), on a scale of 0 to 2. */
const COUPLING = 1.62;
const COUPLING_MAX = 2;

const FILM = videoInfo("heart-dance");

/** Guinevere's colours on a bright page, with Vexana's violet as the thread between them. */
const VARS = {
  "--g-cream": "#fff4e8",
  "--g-peach": "#f6b98a",
  "--g-pink": "#ff9db8",
  "--g-gold": "#f2b63d",
  "--g-red": "#e1322e",
  "--g-ink": "#24110e",
  "--g-soft": "#5a3a30",
  "--g-red-text": "#b3201c",
  "--g-violet": "#7a4fd6",
  "--g-violet-text": "#5b34b5",
  "--g-magenta": "#e040a0",
} as CSSProperties;

const SPARKLES = [
  { x: 6, y: 10, s: 22, d: 0 },
  { x: 47, y: 4, s: 14, d: 0.8 },
  { x: 93, y: 16, s: 26, d: 1.4 },
  { x: 58, y: 62, s: 16, d: 0.4 },
  { x: 3, y: 74, s: 18, d: 1.9 },
  { x: 88, y: 84, s: 20, d: 1.1 },
] as const;

const FACTS = (c: ReturnType<typeof getCharacter>) =>
  [
    ["Aspirant name", c.aspirantName],
    ["Age", c.ageText],
    ["Birthday", c.birthday],
    ["Type", c.mbti],
    ["Role", c.role],
    ["Weapon", c.weapon],
  ] as const;

interface Point {
  x: number;
  y: number;
}

interface Threads {
  w: number;
  h: number;
  a: Point;
  b: Point;
  gold: string;
  violet: string;
}

/**
 * Two curves from `a` to `b`. Both arch over the gap above the print and the heart, and they swap
 * places halfway (one climbs early, the other late), so they cross once like a braid.
 */
function threadPaths(a: Point, b: Point, w: number, h: number): Threads {
  const dx = b.x - a.x;
  const f = (n: number) => n.toFixed(1);
  const curve = (c1: Point, c2: Point) =>
    `M${f(a.x)} ${f(a.y)} C${f(c1.x)} ${f(c1.y)}, ${f(c2.x)} ${f(c2.y)}, ${f(b.x)} ${f(b.y)}`;
  const lift = Math.max(120, Math.min(260, Math.abs(dx) * 0.5));
  return {
    w,
    h,
    a,
    b,
    gold: curve(
      { x: a.x + dx * 0.12, y: a.y - lift },
      { x: b.x - dx * 0.42, y: b.y - lift * 0.15 },
    ),
    violet: curve(
      { x: a.x + dx * 0.42, y: a.y - lift * 0.15 },
      { x: b.x - dx * 0.12, y: b.y - lift },
    ),
  };
}

/**
 * Her best friend. A bright page after the dark ones: Guinevere's splash art hangs as a taped print,
 * Vexana and she dance in a heart-shaped frame that plays by itself (muted) while it is on screen,
 * two threads (her gold, Vexana's violet) are drawn between them, and a meter shows how well they
 * were matched on the day they registered. The play button opens the dance in the site's player.
 */
export function Guinevere() {
  const reduced = useReducedMotion();
  const g = getCharacter("guinevere");
  const quotes = keyVoiceLines("guinevere");
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLSpanElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const tape = useRef<HTMLSpanElement>(null);
  const [quote, setQuote] = useState(0);
  const [threads, setThreads] = useState<Threads | null>(null);

  useVisiblePlay(video, frame, videoFile("heart-dance"));

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (reduced) {
      el.dataset.in = "true";
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          el.dataset.in = "true";
          io.disconnect();
        }
      },
      { threshold: 0.18 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [reduced]);

  // The two threads run from the tape on the print to the top of the heart. They are measured once
  // the pieces have landed (and again when the stage changes size), so they never cross a face.
  useEffect(() => {
    const st = stage.current;
    if (!st) return;
    let timer = 0;
    const measure = () => {
      const t = tape.current;
      const h = frame.current;
      if (!t || !h || st.clientWidth < 900) {
        setThreads(null);
        return;
      }
      const sr = st.getBoundingClientRect();
      const tr = t.getBoundingClientRect();
      const hr = h.getBoundingClientRect();
      setThreads(
        threadPaths(
          { x: tr.left + tr.width / 2 - sr.left, y: tr.top + tr.height / 2 - sr.top },
          { x: hr.left + hr.width / 2 - sr.left, y: hr.top + hr.height * 0.1 - sr.top },
          sr.width,
          sr.height,
        ),
      );
    };
    const start = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, reduced ? 0 : 1500);
    };
    const ro = new ResizeObserver(start);
    ro.observe(st);
    start();
    return () => {
      window.clearTimeout(timer);
      ro.disconnect();
    };
  }, [reduced]);

  // The splash art drifts inside its frame as the page scrolls (the frame itself holds still).
  useEffect(() => {
    const st = stage.current;
    if (!st || reduced) return;
    const things = Array.from(st.querySelectorAll<HTMLElement>("[data-drift]"));
    const trigger = ScrollTrigger.create({
      trigger: st,
      start: "top bottom",
      end: "bottom top",
      onUpdate: (self) => {
        const p = self.progress - 0.5;
        for (const t of things) {
          const d = Number(t.dataset.drift);
          t.style.transform = `translate3d(0, ${(p * d * 2).toFixed(1)}px, 0)`;
        }
      },
    });
    return () => {
      trigger.kill();
    };
  }, [reduced]);

  const q = quotes[quote % Math.max(1, quotes.length)];
  const facts = FACTS(g);

  return (
    <section
      ref={root}
      id="guinevere"
      className={styles.root}
      data-theme="daybreak"
      data-in="false"
      style={VARS}
      aria-labelledby="guinevere-title"
    >
      <div className={styles.field} aria-hidden="true">
        <span className={styles.discA} />
        <span className={styles.discB} />
        {SPARKLES.map((s, i) => (
          <i
            key={i}
            className={styles.sparkle}
            style={
              {
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: s.s,
                height: s.s,
                "--d": `${s.d}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      {/* The heart the dance is cut to (units of the box it is applied to). */}
      <svg width="0" height="0" className={styles.defs} aria-hidden="true" focusable="false">
        <clipPath id="vx-heart" clipPathUnits="objectBoundingBox">
          <path d="M0.5 0.97 C0.5 0.97 0.02 0.66 0.02 0.3 C0.02 0.12 0.15 0.02 0.29 0.02 C0.4 0.02 0.47 0.08 0.5 0.16 C0.53 0.08 0.6 0.02 0.71 0.02 C0.85 0.02 0.98 0.12 0.98 0.3 C0.98 0.66 0.5 0.97 0.5 0.97 Z" />
        </clipPath>
      </svg>

      <header className={styles.head}>
        <p className={styles.eyebrow}>
          <b>08</b>
          <span className={styles.bar} aria-hidden="true" />
          <span>Her best friend</span>
        </p>
        <h2 id="guinevere-title" className={styles.title}>
          <span className={styles.name}>Guinevere</span>
          <span className={styles.serif}>the one who brought colour.</span>
        </h2>
      </header>

      <div ref={stage} className={styles.stage}>
        <figure className={styles.print}>
          <span className={`${styles.tape} ${styles.tapeA}`} aria-hidden="true" />
          <span ref={tape} className={`${styles.tape} ${styles.tapeB}`} aria-hidden="true" />
          <div className={styles.paper}>
            {/* Plain <img>: static export. The small size shows first, the browser picks. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset(artThumb("guinevere-splash-art"))}
              srcSet={`${asset(artThumb("guinevere-splash-art"))} 960w, ${asset(artPath("guinevere-splash-art"))} 2560w`}
              data-drift="-30"
              sizes="(max-width: 800px) 92vw, 60vw"
              alt="Guinevere leaping above the city with her two drones, official splash art"
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          </div>
          <figcaption className={styles.caption}>
            <b>{g.aspirantName}</b>
            <span>{g.jp.script}</span>
          </figcaption>
        </figure>

        {threads ? (
          <svg
            className={styles.threads}
            viewBox={`0 0 ${threads.w} ${threads.h}`}
            aria-hidden="true"
          >
            <path className={styles.threadGold} d={threads.gold} pathLength="1" />
            <path className={styles.threadViolet} d={threads.violet} pathLength="1" />
            <circle className={styles.knot} cx={threads.a.x} cy={threads.a.y} r="7" />
            <circle className={styles.knot} cx={threads.b.x} cy={threads.b.y} r="7" />
          </svg>
        ) : null}

        <div className={styles.heartSlot}>
          <PlayerButton
            video={videoFor("heart-dance", "Vexana and Guinevere, the heart dance")}
            label="Play the heart dance"
            className={styles.heartBtn}
          >
            <span className={styles.heartShadow} aria-hidden="true" />
            <span className={styles.heartRing} aria-hidden="true" />
            <span ref={frame} className={styles.heartClip}>
              {/* Plain <video>: muted and looping, started by the hook while it is on screen. */}
              <video
                ref={video}
                className={styles.heartVideo}
                poster={asset(videoPoster("heart-dance"))}
                muted
                loop
                playsInline
                preload="none"
                tabIndex={-1}
                aria-hidden="true"
              />
            </span>
            <span className={styles.playPill}>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
              Play the dance
              <i>{formatTime(FILM.duration)}</i>
            </span>
          </PlayerButton>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.story}>
          <p className={styles.lead}>
            Guinevere is sixteen and the best close fighter in the Academy. She calls herself the
            Queen. She won the spring Combat Trials with one hand tied behind her back.
          </p>
          <p>
            Vexana was hiding in a broom cupboard. Guinevere found her with a doughnut. It took ten
            days of doughnuts to win her as a partner, and she would do it again.
          </p>
          <p>
            Now they fight as one. Guinevere goes in front. Vexana stands twelve paces behind her,
            and neither of them has to look round. Guinevere made the Emblem of Hope by hand, for
            Vexana.
          </p>

          <div className={styles.meter} role="img" aria-label="Their coupling was 1.62 out of 2">
            <p className={styles.meterLabel}>
              <span>Coupling on the day they registered</span>
              <b>{COUPLING.toFixed(2)}</b>
            </p>
            <div
              className={styles.track}
              style={{ "--v": COUPLING / COUPLING_MAX } as CSSProperties}
            >
              <span className={styles.fill} />
              <span className={styles.needle}>
                <svg viewBox="0 0 24 22" width="26" height="24" aria-hidden="true">
                  <path
                    d="M12 21 C12 21 1.5 14.5 1.5 7.5 C1.5 3.8 4.3 1.5 7.2 1.5 C9.4 1.5 11.2 2.7 12 4.6 C12.8 2.7 14.6 1.5 16.8 1.5 C19.7 1.5 22.5 3.8 22.5 7.5 C22.5 14.5 12 21 12 21 Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
            </div>
            <p className={styles.ends}>
              <span className={styles.endGold}>Guinevere</span>
              <span className={styles.endViolet}>Vexana</span>
            </p>
          </div>
        </div>

        <div className={styles.side}>
          <dl className={styles.facts}>
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          {q ? (
            <blockquote className={styles.quote} aria-live="polite">
              <p key={q.n} className={styles.quoteText}>
                {q.en}
              </p>
              <p className={styles.quoteJp} lang="ja">
                {q.jpTitle}
              </p>
              <button
                type="button"
                className={styles.another}
                onPointerEnter={() => {
                  audio.blip("hover");
                }}
                onClick={() => {
                  audio.blip("click");
                  setQuote((n) => n + 1);
                }}
              >
                Another line
                <span aria-hidden="true">
                  {(quote % quotes.length) + 1} / {quotes.length}
                </span>
              </button>
            </blockquote>
          ) : null}
        </div>
      </div>
    </section>
  );
}
