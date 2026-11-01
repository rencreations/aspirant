"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { riseRadius, riseScale } from "@/features/character/vexana/cover/cover-math";
import { useScrollSnap, type SnapRange } from "@/features/character/vexana/seams/snap";

import styles from "./rise.module.css";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/**
 * The page rising over the hero: the same join as the one from Vexana's pair to her interlude
 * (`features/character/vexana/cover/cover.tsx`), with a plain page in place of the film. The panel
 * overlaps the last screen of the hero by one screen (`margin-top: -100lvh`, and the hero keeps that
 * screen stuck with a `Hold`), so plain scrolling makes it come up from the bottom, narrower than
 * the screen at first with the hero showing at both sides, and zoom out to the full width (`riseScale`,
 * a scale about its top middle). Its top corners are rounded and sharpen slowly, then quickly, and
 * are square from 60 percent of the way, so when it has come all the way it covers the screen with
 * no corner and no gap. The rise can never be left half way: stop in it and, after a second without
 * input, it goes on from the half and goes back before it (`useScrollSnap`), in both directions.
 *
 * Only `transform` is written while it rises (and the radius of the corners until 60 percent). The
 * transform is gone again when the rise is over, so nothing inside the panel is ever scaled while
 * the visitor reads it.
 */
export function StoryRise({
  id,
  onProgress,
  theme,
  className,
  style,
  children,
}: {
  id: string;
  /** Called with the progress of the rise, 0 (not started) to 1 (it covers the screen). */
  onProgress?: (p: number) => void;
  theme: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const span = useRef<SnapRange | null>(null);
  const progress = useRef(onProgress);
  useEffect(() => {
    progress.current = onProgress;
  });

  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const radius = () => Math.min(72, Math.max(24, window.innerWidth * 0.045));
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top bottom",
      end: "top top",
      invalidateOnRefresh: true,
      onRefresh: (self) => {
        span.current = { start: self.start, end: self.end };
      },
      onUpdate: (self) => {
        const p = self.progress;
        const r = riseRadius(p, radius());
        el.style.transform = p <= 0 || p >= 1 ? "" : `scale(${riseScale(p).toFixed(4)})`;
        el.style.borderRadius = r < 0.5 ? "0" : `${r.toFixed(1)}px ${r.toFixed(1)}px 0 0`;
        progress.current?.(p);
      },
    });
    span.current = { start: st.start, end: st.end };
    progress.current?.(st.progress);
    return () => {
      st.kill();
      span.current = null;
      el.style.transform = "";
      el.style.borderRadius = "";
    };
  }, []);

  // A stop inside the rise snaps after one second without input.
  useScrollSnap(id, () => span.current, { idleMs: 1000 });

  return (
    <div
      ref={panel}
      id={id}
      className={[styles.rise, className].filter(Boolean).join(" ")}
      style={style}
      data-theme={theme}
    >
      {children}
    </div>
  );
}
