"use client";

import { useEffect, useRef, useState } from "react";

import { ThemeZone } from "@/components/theme-zone";
import { TLink } from "@/components/transition/t-link";
import { audio } from "@/lib/audio";
import { routes } from "@/lib/site";

import type { ContrastView } from "../types";
import styles from "./before-after.module.css";

/**
 * Before and after (after why.zero.university): a confident line, struck out as it scrolls
 * into view and replaced by its opposite, while the strip drains from Daybreak to Storm.
 * Hover, tap or press to flip it back and forth. The quote under it is the story's own.
 */
export function BeforeAfter({ contrast }: { contrast: ContrastView }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const downType = useRef("");
  const [struck, setStruck] = useState(false);
  const [peek, setPeek] = useState(false);
  const after = struck ? !peek : peek;
  const side = after ? contrast.after : contrast.before;

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        setStruck(true);
      },
      { threshold: 0.55 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <ThemeZone
      theme={after ? "storm" : "daybreak"}
      aria-labelledby="before-after-title"
      className={styles.section}
      data-state={after ? "after" : "before"}
    >
      <div className={styles.glow} aria-hidden="true" />
      <div ref={rootRef} className={`${styles.inner} shell`}>
        <div className={styles.meta}>
          <h2 id="before-after-title" className={styles.kicker}>
            04 / Before and after
          </h2>
          <p className={styles.place}>{contrast.place}</p>
        </div>

        <button
          type="button"
          className={styles.lines}
          aria-pressed={after}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") {
              setPeek((p) => !p);
              audio.blip("whoosh");
            }
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setPeek((p) => !p);
          }}
          onPointerDown={(e) => {
            downType.current = e.pointerType;
          }}
          onClick={() => {
            // Mouse users flip by hovering; taps and keys flip on click.
            const type = downType.current;
            downType.current = "";
            if (type === "mouse") return;
            audio.unlock();
            audio.blip("click");
            setPeek((p) => !p);
          }}
        >
          <span className={styles.before}>
            {contrast.before.line}
            <span className={styles.strike} aria-hidden="true" />
          </span>
          <span className={styles.after}>{contrast.after.line}</span>
        </button>

        <figure className={styles.quote} key={after ? "after" : "before"}>
          <blockquote className={styles.quoteText}>
            <p>{side.quote}</p>
          </blockquote>
          <figcaption className={styles.cite}>{side.chapter}</figcaption>
        </figure>

        <TLink href={routes.story} className={styles.more} transitionLabel="Story">
          See the world
          <span aria-hidden="true" className={styles.arrow}>
            &rarr;
          </span>
        </TLink>
      </div>
    </ThemeZone>
  );
}
