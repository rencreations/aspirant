"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { ThemeZone } from "@/components/theme-zone";
import { HudPanel } from "@/components/ui/hud-panel";
import { cycle } from "@/content/world";
import { getEntity } from "@/content/entities";
import { audio } from "@/lib/audio";
import { useInView, useReducedMotion } from "@/lib/hooks";
import { wrap } from "@/lib/math";

import { ChapterLink } from "../chapter-link";
import { SectionHead } from "../section-head";
import styles from "./cycle.module.css";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger, useGSAP);

const COLOURS = ["var(--cyan)", "var(--crimson)", "var(--amber)", "var(--gold)"] as const;
const GLOWS = [
  "var(--light-cyan)",
  "var(--light-crimson)",
  "var(--light-amber)",
  "var(--light-gold)",
] as const;

/** SVG arc between two angles (degrees, 0 at the top, clockwise) on a circle of radius r. */
function arc(from: number, to: number, r: number): string {
  const p = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`;
  };
  return `M${p(from)} A${r} ${r} 0 0 1 ${p(to)}`;
}

/**
 * The Cycle as a ring you turn. Four stages sit on the ring; pick one (click, tap, arrow keys
 * or the turn buttons) and the ring rotates it to the top while the panel reads it. An ember
 * travels the ring on its own. The four stages and the quotes are Chapter 24's words.
 */
export function Cycle() {
  const rootRef = useRef<HTMLElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [index, setIndex] = useState(0);
  const [turns, setTurns] = useState(0);
  const reduced = useReducedMotion();
  const inView = useInView(rootRef, { rootMargin: "80px" });
  const stages = cycle.stages;
  const stage = stages[index] ?? stages[0];
  const embers = getEntity("embers");

  // The ring turns by the shortest way round, so `turns` keeps counting past a full circle.
  const go = (next: number, focus = false) => {
    const target = wrap(next, stages.length);
    const delta = wrap(target - index + 2, stages.length) - 2;
    setTurns((t) => t + delta);
    setIndex(target);
    audio.blip("click");
    if (focus) tabRefs.current[target]?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const key = e.key;
    if (key === "ArrowRight" || key === "ArrowDown") go(index + 1, true);
    else if (key === "ArrowLeft" || key === "ArrowUp") go(index - 1, true);
    else if (key === "Home") go(0, true);
    else if (key === "End") go(stages.length - 1, true);
    else return;
    e.preventDefault();
  };

  useGSAP(
    () => {
      const outer = outerRef.current;
      if (!outer || reduced) return;
      gsap.fromTo(
        outer,
        { rotation: -50 },
        {
          rotation: 50,
          ease: "none",
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.8,
          },
        },
      );
    },
    { scope: rootRef, dependencies: [reduced] },
  );

  if (!stage) return null;
  const accent = COLOURS[index] ?? COLOURS[0];
  const glow = GLOWS[index] ?? GLOWS[0];

  return (
    <ThemeZone theme="daybreak" aria-labelledby="cycle-title" className={styles.section}>
      <section
        ref={rootRef}
        className="shell"
        style={{ "--accent": accent, "--glow": glow } as CSSProperties}
        data-run={inView}
      >
        <SectionHead
          id="cycle-title"
          code="03 / The Cycle"
          title="It happens again"
          lead="Four stages, one loop. Turn the ring to read each one."
        />

        <div className={styles.layout}>
          <div
            className={styles.ringWrap}
            style={{ "--rot": `${-turns * 90}deg` } as CSSProperties}
          >
            <div ref={outerRef} className={styles.outer} aria-hidden="true">
              {Array.from({ length: 48 }, (_, i) => (
                <span
                  key={i}
                  className={styles.tick}
                  style={{ "--a": `${i * 7.5}deg` } as CSSProperties}
                />
              ))}
            </div>
            <div ref={ringRef} className={styles.ring}>
              <svg
                className={styles.svg}
                viewBox="0 0 100 100"
                aria-hidden="true"
                focusable="false"
              >
                <circle className={styles.track} cx="50" cy="50" r="40" />
                {stages.map((s, i) => (
                  <path
                    key={s.id}
                    d={arc(i * 90 + 14, i * 90 + 76, 40)}
                    className={styles.seg}
                    data-on={i === index}
                    style={{ "--c": COLOURS[i] } as CSSProperties}
                  />
                ))}
              </svg>
              <div className={styles.orbit} aria-hidden="true">
                <span className={styles.ember} />
              </div>
              <div role="tablist" aria-label="The four stages of the Cycle" className={styles.tabs}>
                {stages.map((s, i) => (
                  <button
                    key={s.id}
                    ref={(el) => {
                      tabRefs.current[i] = el;
                    }}
                    id={`cycle-tab-${s.id}`}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-controls="cycle-panel"
                    tabIndex={i === index ? 0 : -1}
                    className={styles.node}
                    style={{ "--a": `${i * 90}deg`, "--c": COLOURS[i] } as CSSProperties}
                    data-cursor="TURN"
                    onClick={() => go(i)}
                    onKeyDown={onKey}
                  >
                    <span className={styles.nodeNum}>{i + 1}</span>
                    <span className={styles.nodeName}>{s.title}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.core} aria-hidden="true">
              <span className={styles.coreNum}>{String(index + 1).padStart(2, "0")}</span>
              <span className={`${styles.coreOf} hud-label`}>of 04</span>
            </div>
          </div>

          <div className={styles.read}>
            <HudPanel
              label={`Stage ${index + 1} of 4`}
              code="Chapter 24"
              accent={accent}
              tone="glass"
              scan
            >
              <div
                id="cycle-panel"
                role="tabpanel"
                aria-labelledby={`cycle-tab-${stage.id}`}
                aria-live="polite"
                key={stage.id}
                className={styles.panel}
              >
                <h3 className={`${styles.stageTitle} display`}>{stage.title}</h3>
                <p className={styles.stageText}>{stage.text}</p>
                <blockquote className={styles.quote}>{stage.quote}</blockquote>
                <div className={styles.actions}>
                  <ChapterLink id={stage.chapterId} />
                  <button type="button" className={styles.turn} onClick={() => go(index - 1)}>
                    Turn back
                  </button>
                  <button type="button" className={styles.turn} onClick={() => go(index + 1)}>
                    Turn on
                  </button>
                </div>
              </div>
            </HudPanel>
            {embers && (
              <p className={styles.define}>
                <span className="hud-label">Embers</span>
                <span>{embers.short}</span>
              </p>
            )}
            <p className={styles.whole}>{cycle.quote}</p>
          </div>
        </div>
      </section>
    </ThemeZone>
  );
}
