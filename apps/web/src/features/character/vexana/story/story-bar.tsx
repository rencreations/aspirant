"use client";

import type { Route } from "next";
import { useEffect, useRef } from "react";

import { TLink } from "@/components/transition/t-link";

import type { StorySide } from "./story-page";
import styles from "./story-bar.module.css";

const ROUTES: Record<StorySide, Route> = {
  academic: "/character/vexana/story/academic",
  ender: "/character/vexana/story/ender",
};

/**
 * The strip under the site's bar: back to her page, the two halves of the story as a switch, and
 * a hairline that fills as the page is read (a transform, written once per frame at most).
 */
export function StoryBar({ side }: { side: StorySide }) {
  const line = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = line.current;
    if (!el) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      el.style.transform = `scaleX(${p.toFixed(4)})`;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div className={styles.bar} data-side={side}>
      <TLink href={"/character/vexana"} transitionLabel="Vexana" className={styles.back}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M18 12H6m5-5-5 5 5 5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span>Vexana</span>
      </TLink>
      <nav className={styles.tabs} aria-label="The two halves of her story">
        {(["academic", "ender"] as const).map((s, i) => (
          <TLink
            key={s}
            href={ROUTES[s]}
            transitionLabel={s === "academic" ? "Academic" : "Ender"}
            className={styles.tab}
            aria-current={s === side ? "page" : undefined}
          >
            <span className={styles.num}>{i + 1}</span>
            {s === "academic" ? "Academic" : "Ender"}
          </TLink>
        ))}
      </nav>
      <p className={styles.note}>Spoilers. This is the story itself.</p>
      <span className={styles.track} aria-hidden="true">
        <span ref={line} className={styles.fill} />
      </span>
    </div>
  );
}
