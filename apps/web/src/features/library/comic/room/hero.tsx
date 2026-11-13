"use client";

import { useCallback, useRef, useSyncExternalStore, type CSSProperties } from "react";

import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";

import type { ComicStageData } from "../types";
import styles from "./hero.module.css";
import { sparkBurst } from "./stage";

/** Whether the screen is a narrow one: the word stands in two rows there. */
function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia("(max-width: 58rem)");
  mq.addEventListener("change", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
  };
}
const narrowNow = () => window.matchMedia("(max-width: 58rem)").matches;

/**
 * The letters of COMIC, drawn for this page: a thick round stroke, no font file. Each is a path in
 * a box 240 high; `w` is how much room it takes. The stroke is 70 wide.
 */
interface Glyph {
  ch: string;
  d: string;
  w: number;
  /** The panel that fills it. */
  art: string;
  /** Where the panel is shown from (its focus). */
  at: string;
}

const STROKE = 70;

const GLYPHS: readonly Glyph[] = [
  { ch: "C", d: "M 184 66 A 105 105 0 1 0 184 214", w: 224, art: "as-layla-burst", at: "50% 40%" },
  {
    ch: "O",
    d: "M 110 140 m -98 0 a 98 100 0 1 0 196 0 a 98 100 0 1 0 -196 0",
    w: 224,
    art: "gv-vexana",
    at: "50% 30%",
  },
  {
    ch: "M",
    d: "M 28 250 L 28 40 L 110 196 L 192 40 L 192 250",
    w: 224,
    art: "as-layla-sword",
    at: "50% 30%",
  },
  { ch: "I", d: "M 60 40 L 60 250", w: 124, art: "gv-boom", at: "30% 40%" },
  { ch: "C", d: "M 184 66 A 105 105 0 1 0 184 214", w: 224, art: "gv-gold", at: "50% 30%" },
];

/** Where each letter stands: one row, or two on a narrow screen. */
function layout(narrow: boolean): Array<{ x: number; y: number }> {
  const gap = 26;
  if (!narrow) {
    let x = 0;
    return GLYPHS.map((g) => {
      const at = { x, y: 0 };
      x += g.w + gap;
      return at;
    });
  }
  // COM above, IC below, each row centred in the width of the first.
  const row1 = GLYPHS.slice(0, 3).reduce((n, g) => n + g.w + gap, -gap);
  const row2 = GLYPHS.slice(3).reduce((n, g) => n + g.w + gap, -gap);
  const out: Array<{ x: number; y: number }> = [];
  let x = 0;
  for (const g of GLYPHS.slice(0, 3)) {
    out.push({ x, y: 0 });
    x += g.w + gap;
  }
  x = (row1 - row2) / 2;
  for (const g of GLYPHS.slice(3)) {
    out.push({ x, y: 300 });
    x += g.w + gap;
  }
  return out;
}

interface HeroProps {
  stage: ComicStageData;
  official: number;
  fans: number;
  /** The way down: scroll to the next section. */
  onCue: () => void;
}

/**
 * The first screen of the comic room: the word COMIC fills it, a field of halftone dots and speed
 * lines behind it. Every letter has a life of its own. Idle: it floats on its own beat and the
 * picture in it drifts. Hover: it jumps and the picture speeds up. Press: it pops and sparks fly.
 * Under it one small line says what is here, and a button says where to go next.
 */
export function ComicHero({ stage, official, fans, onCue }: HeroProps) {
  const narrow = useSyncExternalStore(subscribe, narrowNow, () => false);
  const root = useRef<HTMLElement>(null);
  const fx = useRef<HTMLDivElement>(null);
  const places = layout(narrow);
  const rows = narrow ? 2 : 1;
  const width = narrow
    ? GLYPHS.slice(0, 3).reduce((n, g) => n + g.w + 26, -26)
    : GLYPHS.reduce((n, g) => n + g.w + 26, -26);
  const height = rows === 2 ? 300 + 270 : 270;

  const press = useCallback((e: React.MouseEvent<SVGGElement>) => {
    audio.blip("click");
    const layer = fx.current;
    const el = root.current;
    if (layer && el) sparkBurst(layer, el.getBoundingClientRect(), e.clientX, e.clientY, 14);
    const g = e.currentTarget;
    g.removeAttribute("data-pop");
    void (g as unknown as HTMLElement).getBoundingClientRect();
    g.setAttribute("data-pop", "true");
  }, []);

  return (
    <section ref={root} className={styles.hero} id="comic-top" aria-labelledby="comic-title">
      <div className={styles.dots} aria-hidden="true" />
      <svg className={styles.rays} viewBox="0 0 100 100" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => {
          const a0 = (i / 24) * Math.PI * 2;
          const a1 = a0 + Math.PI / 24;
          const p = (a: number) =>
            `${(50 + Math.cos(a) * 80).toFixed(2)},${(50 + Math.sin(a) * 80).toFixed(2)}`;
          return <polygon key={i} points={`50,50 ${p(a0)} ${p(a1)}`} />;
        })}
      </svg>

      <h1 id="comic-title" className="sr-only">
        Comic
      </h1>
      <div className={styles.wordWrap}>
        <svg
          className={styles.word}
          viewBox={`-30 -10 ${width + 70} ${height + 40}`}
          role="img"
          aria-label="COMIC"
        >
          <defs>
            <pattern
              id="hero-halftone"
              width="14"
              height="14"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(30)"
            >
              <circle cx="7" cy="7" r="2.6" fill="#14121a" opacity="0.22" />
            </pattern>
            {GLYPHS.map((g, i) => (
              <mask
                key={i}
                id={`hero-mask-${i}`}
                maskUnits="userSpaceOnUse"
                x="-60"
                y="-60"
                width="420"
                height="420"
              >
                <path
                  d={g.d}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </mask>
            ))}
          </defs>
          {GLYPHS.map((g, i) => {
            const at = places[i] ?? { x: 0, y: 0 };
            const panel = stage.panels[g.art];
            return (
              <g key={i} transform={`translate(${at.x} ${at.y})`}>
                <g
                  className={styles.letter}
                  data-i={i}
                  style={{ "--i": i } as CSSProperties}
                  onClick={press}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") audio.blip("hover");
                  }}
                  onAnimationEnd={(e) => {
                    if (e.animationName.includes("pop"))
                      e.currentTarget.removeAttribute("data-pop");
                  }}
                >
                  <path
                    d={g.d}
                    className={styles.cast}
                    strokeWidth={STROKE + 38}
                    transform="translate(13 17)"
                  />
                  <path d={g.d} className={styles.edge} strokeWidth={STROKE + 32} />
                  <path d={g.d} className={styles.rim} strokeWidth={STROKE + 12} />
                  <g mask={`url(#hero-mask-${i})`}>
                    <rect x="-60" y="-60" width="420" height="420" fill={panel?.c ?? "#888"} />
                    {panel ? (
                      <image
                        className={styles.art}
                        href={libUrl(panel.p)}
                        x="-80"
                        y="-40"
                        width="400"
                        height="360"
                        preserveAspectRatio="xMidYMid slice"
                        style={{ "--at": g.at } as CSSProperties}
                      />
                    ) : null}
                    <rect x="-60" y="-60" width="420" height="420" fill="url(#hero-halftone)" />
                  </g>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      <p className={`${styles.count} hud-label`}>
        <span>{official} official comics</span>
        <span className={styles.sep} aria-hidden="true" />
        <span>{fans} made by fans</span>
      </p>

      <button type="button" className={styles.cue} onClick={onCue}>
        <span className={styles.cueText}>Scroll to read</span>
        <span className={styles.cueBall} aria-hidden="true">
          <svg viewBox="0 0 16 16" width="16" height="16">
            <path
              d="M3 6l5 5 5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      <div ref={fx} className={styles.fx} aria-hidden="true" />
    </section>
  );
}
