"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";

import { prefersReducedMotion } from "@/lib/hooks";

import styles from "./text-effects.module.css";

export interface SplitTextProps {
  /** The text. Rendered once for assistive tech, split for the effect. */
  text: string;
  /** Element to render. Default "span". Use "h2", "p" and so on for real text blocks. */
  as?: keyof HTMLElementTagNameMap;
  /** Split into characters, words (default) or lines. Lines rise from a mask, line by line. */
  by?: "chars" | "words" | "lines";
  /** Play on mount or when it scrolls into view (default). */
  trigger?: "mount" | "inview";
  /** Delay before the first unit, in seconds. */
  delay?: number;
  /** Seconds between units (or lines). Defaults: chars 0.025, words 0.06, lines 0.12. */
  stagger?: number;
  className?: string;
}

const DEFAULT_STAGGER = { chars: 0.025, words: 0.06, lines: 0.12 } as const;

/**
 * Reveal text by characters, words or lines with GSAP. Screen readers get the plain text
 * (sr-only copy); the animated spans are aria-hidden. Server HTML and no-JS show the text;
 * under reduced motion it renders plainly with no animation.
 *
 * <SplitText as="h2" by="lines" text="Someone is always waiting." />
 */
export function SplitText({
  text,
  as,
  by = "words",
  trigger = "inview",
  delay = 0,
  stagger,
  className,
}: SplitTextProps) {
  // Typed as a single intrinsic tag (HTMLElement props): an ElementType union breaks once
  // @react-three/fiber augments JSX.IntrinsicElements.
  const Tag = (as ?? "span") as "span";
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const units = Array.from(root.querySelectorAll<HTMLElement>("[data-unit]"));
    if (prefersReducedMotion() || units.length === 0) {
      root.removeAttribute("data-split-pending");
      return;
    }

    const each = stagger ?? DEFAULT_STAGGER[by];
    let lineOf: number[] = [];
    if (by === "lines") {
      const tops: number[] = [];
      lineOf = units.map((u) => {
        const top = u.parentElement?.offsetTop ?? 0;
        let i = tops.findIndex((t) => Math.abs(t - top) < 4);
        if (i < 0) i = tops.push(top) - 1;
        return i;
      });
    }

    const from =
      by === "chars" ? { opacity: 0, yPercent: 60, rotate: 8 } : { opacity: 0, yPercent: 110 };
    gsap.set(units, from);
    root.removeAttribute("data-split-pending");

    let tween: gsap.core.Tween | null = null;
    const play = () => {
      tween = gsap.to(units, {
        opacity: 1,
        yPercent: 0,
        rotate: 0,
        duration: by === "chars" ? 0.7 : 0.9,
        ease: "expo.out",
        delay,
        stagger: by === "lines" ? (i: number) => (lineOf[i] ?? 0) * each : each,
      });
    };

    let observer: IntersectionObserver | null = null;
    if (trigger === "mount" || typeof IntersectionObserver === "undefined") {
      play();
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            observer?.disconnect();
            play();
          }
        },
        { rootMargin: "0px 0px -10% 0px" },
      );
      observer.observe(root);
    }

    return () => {
      observer?.disconnect();
      tween?.kill();
      gsap.set(units, { clearProps: "opacity,transform" });
    };
  }, [text, by, trigger, delay, stagger]);

  const words = text.split(/(\s+)/);

  return (
    <Tag ref={ref} className={className} data-split-pending="">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, wi) => {
          if (/^\s+$/.test(word)) return word;
          if (!word) return null;
          if (by === "chars") {
            return (
              <span key={wi} className={styles.word}>
                {Array.from(word).map((ch, ci) => (
                  <span key={ci} data-unit="" className={styles.unit}>
                    {ch}
                  </span>
                ))}
              </span>
            );
          }
          return (
            <span key={wi} className={styles.mask}>
              <span data-unit="" className={styles.unit}>
                {word}
              </span>
            </span>
          );
        })}
      </span>
    </Tag>
  );
}
