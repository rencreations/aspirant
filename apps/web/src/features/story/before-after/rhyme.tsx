"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

import { ThemeZone } from "@/components/theme-zone";
import { storyIndex } from "@/content/story";
import { useReducedMotion } from "@/lib/hooks";

import styles from "./rhyme.module.css";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * The old skipping rhyme from Dawnbreak, set large. Each line takes the rope's turn: it
 * lands a little to one side, and its words light up one after another as you scroll. The
 * last line is the one the Cycle makes true.
 */
export function Rhyme() {
  const rootRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { lines, attribution } = storyIndex.epigraph;

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || reduced) return;
      const words = Array.from(root.querySelectorAll<HTMLElement>("[data-w]"));
      if (!words.length) return;
      gsap.fromTo(
        words,
        { opacity: 0.1, yPercent: 38 },
        {
          opacity: 1,
          yPercent: 0,
          ease: "none",
          stagger: 1,
          scrollTrigger: { trigger: root, start: "top 70%", end: "bottom 62%", scrub: 0.6 },
        },
      );
      gsap.fromTo(
        root.querySelectorAll("[data-rope]"),
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { trigger: root, start: "top 60%", end: "bottom 60%", scrub: 0.6 },
        },
      );
    },
    { scope: rootRef, dependencies: [reduced] },
  );

  return (
    <ThemeZone theme="storm" aria-labelledby="rhyme-title" className={styles.section}>
      <section ref={rootRef} className="shell">
        <h3 id="rhyme-title" className={`${styles.kicker} hud-label`}>
          An old skipping rhyme from Dawnbreak
        </h3>
        <blockquote className={styles.poem}>
          <span className="sr-only">{lines.join(" ")}</span>
          {lines.map((line, i) => (
            <p
              key={line}
              className={`${styles.line} ${i === lines.length - 1 ? styles.last : ""}`}
              data-line={i}
              aria-hidden="true"
            >
              {line.split(" ").map((word, w) => (
                <span key={w} className={styles.word} data-w="">
                  {word}{" "}
                </span>
              ))}
            </p>
          ))}
          <span className={styles.rope} data-rope="" aria-hidden="true" />
        </blockquote>
        <p className={`${styles.note} hud-label`}>{attribution}</p>
      </section>
    </ThemeZone>
  );
}
