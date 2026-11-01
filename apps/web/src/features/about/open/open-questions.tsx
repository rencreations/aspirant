"use client";

import { useEffect, useRef, useState } from "react";

import { StarGlyph } from "@/components/star-glyph";
import { ThemeZone } from "@/components/theme-zone";
import { openQuestions } from "@/content/world";
import { audio } from "@/lib/audio";
import { useMediaQuery } from "@/lib/hooks";

import { ChapterLink } from "../chapter-link";
import { SectionHead } from "../section-head";
import styles from "./open-questions.module.css";

/** A wax seal: a hexagon with the Emblem star, drawn once and cut in two to break. */
function Seal({ half }: { half?: "l" | "r" }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={`${styles.seal} ${half === "l" ? styles.sealL : half === "r" ? styles.sealR : ""}`}
      aria-hidden="true"
      focusable="false"
    >
      <polygon
        points="60,6 107,33 107,87 60,114 13,87 13,33"
        fill="var(--crimson)"
        stroke="var(--light-gold)"
        strokeWidth="2"
      />
      <polygon
        points="60,18 97,39 97,81 60,102 23,81 23,39"
        fill="none"
        stroke="var(--light-gold)"
        strokeOpacity="0.6"
        strokeWidth="1"
        strokeDasharray="3 4"
      />
      <path
        d="M60 28C62.6 50 70 57.4 92 60C70 62.6 62.6 70 60 92C57.4 70 50 62.6 28 60C50 57.4 57.4 50 60 28Z"
        fill="var(--light-gold)"
      />
    </svg>
  );
}

/**
 * Three sealed cards, one for each question the story leaves open. The seal breaks on hover
 * (a mouse), a tap, or Enter and Space, and the story's own sentence appears. Nothing here
 * answers anything: the text is exactly what the back matter says.
 */
export function OpenQuestions() {
  const [open, setOpen] = useState<readonly boolean[]>(() => openQuestions.map(() => false));
  const pinned = useRef<boolean[]>(openQuestions.map(() => false));
  const timer = useRef(0);
  const fine = useMediaQuery("(hover: hover) and (pointer: fine)");

  useEffect(() => {
    const t = timer.current;
    return () => window.clearTimeout(t);
  }, []);

  const set = (i: number, value: boolean) =>
    setOpen((prev) => prev.map((v, k) => (k === i ? value : v)));

  return (
    <ThemeZone theme="daybreak" aria-labelledby="open-title" className={styles.section}>
      <section className="shell">
        <SectionHead
          id="open-title"
          code="08 / What the story leaves open"
          title="Still sealed"
          lead="Three questions. The story ends with hope, not with an answer. Break a seal to read what it says."
        />

        <ul className={styles.cards}>
          {openQuestions.map((q, i) => {
            const on = open[i] === true;
            return (
              <li key={q.question} className={styles.card} data-open={on}>
                <button
                  type="button"
                  className={styles.hit}
                  aria-expanded={on}
                  aria-controls={`open-answer-${i}`}
                  data-cursor={on ? "SEALED" : "UNSEAL"}
                  onClick={() => {
                    const next = !on;
                    pinned.current[i] = next;
                    set(i, next);
                    audio.blip(next ? "confirm" : "click");
                  }}
                  onPointerEnter={(e) => {
                    if (e.pointerType !== "mouse" || !fine || on) return;
                    window.clearTimeout(timer.current);
                    timer.current = window.setTimeout(() => {
                      set(i, true);
                      audio.blip("star");
                    }, 140);
                  }}
                  onPointerLeave={(e) => {
                    window.clearTimeout(timer.current);
                    if (e.pointerType === "mouse" && fine && !pinned.current[i]) set(i, false);
                  }}
                >
                  <span className={`${styles.kicker} hud-label`}>
                    Open question {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className={styles.question}>{q.question}</span>
                  <span className={styles.stage} aria-hidden="true">
                    <span className={styles.halfL}>
                      <Seal half="l" />
                    </span>
                    <span className={styles.halfR}>
                      <Seal half="r" />
                    </span>
                    <span className={styles.crack} />
                  </span>
                  <span className={`${styles.state} hud-label`}>
                    {on
                      ? "Seal broken. Press to close it again"
                      : "Sealed. Hover, tap or press Enter"}
                  </span>
                </button>
                <div
                  id={`open-answer-${i}`}
                  role="region"
                  aria-label={`What the story says: ${q.question}`}
                  className={styles.answer}
                >
                  <StarGlyph className={styles.answerStar} />
                  <p>{q.answer}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className={styles.lamp}>
          <svg viewBox="0 0 80 120" className={styles.lampArt} aria-hidden="true" focusable="false">
            <circle cx="40" cy="52" r="34" className={styles.lampHalo} />
            <path d="M28 40h24l-3 40H31z" fill="none" stroke="var(--light-gold)" strokeWidth="2" />
            <path d="M40 78c-9-10-7-22 0-32 7 10 9 22 0 32z" className={styles.flame} />
            <path
              d="M24 40h32M36 28h8v12h-8M30 84h20v8H30z"
              fill="none"
              stroke="var(--light-gold)"
              strokeWidth="2"
            />
          </svg>
          <div className={styles.lampText}>
            <p className={styles.closing}>
              These are open on purpose. The story does show one thing: Karina keeps a lamp burning
              on the bell tower. Someone is always waiting.
            </p>
            <ChapterLink id="c60" />
          </div>
        </div>
      </section>
    </ThemeZone>
  );
}
