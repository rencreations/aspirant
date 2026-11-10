"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { riseRadius, riseScale } from "@/features/character/vexana/cover/cover-math";
import { useScrollSnap, type SnapRange } from "@/features/character/vexana/seams/snap";

import styles from "./rise.module.css";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** How far the shadow along an edge has come in, from 0 (the edge is at the screen's edge) to 1. */
const shadowIn = (p: number) => clamp01(p / 0.14);

/**
 * The page that rises over the hero and, at its far end, leaves again (see `story-landing.tsx`).
 * The hero is one fixed layer behind it. The panel starts one screen down, so plain scrolling makes
 * it come up from the bottom, narrower than the screen at first with the hero showing at both sides,
 * and zoom out to the full width (`riseScale`, a scale about its top middle). Its top corners are
 * rounded and sharpen slowly, then quickly, and are square from 60 percent of the way, so when it has
 * come all the way it covers the screen with no corner and no gap.
 *
 * At the other end it does the same thing backwards: the last screen of scrolling takes its bottom
 * edge up the screen while it narrows about its bottom middle and its bottom corners round, and the
 * hero is back, exactly as it was at the top. The page then starts over (`story-landing.tsx`).
 *
 * Neither can be left half way: stop in one and, after a second without input, it goes on from the
 * half and goes back before it (`useScrollSnap`), in both directions.
 *
 * Only `transform` is written while it moves (and the radius of the corners, and the opacity of the
 * two soft shadows along its edges). The transform is gone again when it is over, so nothing inside
 * the panel is ever scaled while the visitor reads it.
 */
export function StoryRise({
  id,
  onProgress,
  onOver,
  theme,
  className,
  style,
  children,
}: {
  id: string;
  /**
   * Called with how far the page covers the hero: 0 (not at all), 1 (it covers the screen). It
   * is the rise at the top of the page and the leaving, backwards, at the end of it.
   */
  onProgress?: (cover: number) => void;
  /**
   * Called when the panel starts or stops covering the top of the screen, where the top bar sits
   * (the bar is bare over the hero and has a page colour over the panel).
   */
  onOver?: (over: boolean) => void;
  theme: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const shadowTop = useRef<HTMLSpanElement>(null);
  const shadowBottom = useRef<HTMLSpanElement>(null);
  const rise = useRef<SnapRange | null>(null);
  const leave = useRef<SnapRange | null>(null);
  const progress = useRef(onProgress);
  const over = useRef(onOver);
  useEffect(() => {
    progress.current = onProgress;
    over.current = onOver;
  });

  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const radius = () => Math.min(72, Math.max(24, window.innerWidth * 0.045));
    /** The progress of the rise (0 to 1) and of the leaving (0 to 1), written by the two triggers. */
    let up = 0;
    let out = 0;
    let lastCover = -1;
    let lastMode = "";
    let lastOver: boolean | null = null;
    let lastGone = false;

    const apply = () => {
      const leaving = out > 0 && out < 1;
      const rising = !leaving && up > 0 && up < 1;
      // The leaving is the rise played backwards: the cover is 1 at its start and 0 at its end.
      const cover = out > 0 ? 1 - out : up;
      const r = riseRadius(cover, radius());
      const round = r < 0.5 ? "0" : `${r.toFixed(1)}px`;
      const mode = leaving ? "leave" : rising ? "rise" : "rest";
      if (mode !== lastMode) {
        lastMode = mode;
        el.style.transformOrigin = leaving ? "50% 100%" : "50% 0";
      }
      el.style.transform = leaving || rising ? `scale(${riseScale(cover).toFixed(4)})` : "";
      el.style.borderRadius = leaving
        ? `0 0 ${round} ${round}`
        : rising
          ? `${round} ${round} 0 0`
          : "0";
      if (shadowTop.current)
        shadowTop.current.style.opacity = String(Number(shadowIn(up).toFixed(3)));
      if (shadowBottom.current)
        shadowBottom.current.style.opacity = String(Number(shadowIn(1 - out).toFixed(3)));
      // The panel's top edge is at (1 - up) screens down, its bottom edge at (1 - out) screens down.
      const edge = 1 - 6 / window.innerHeight;
      const covers = up > edge && out < edge;
      // The last pixels of the leaving: the panel is gone (the page starts over right after), so no
      // thin edge of it is left on the top of the screen.
      const gone = out >= 0.99;
      if (gone !== lastGone) {
        lastGone = gone;
        el.style.visibility = gone ? "hidden" : "";
      }
      if (covers !== lastOver) {
        lastOver = covers;
        over.current?.(covers);
      }
      if (cover !== lastCover) {
        lastCover = cover;
        progress.current?.(cover);
      }
    };

    // A refresh measures the panel, and a scale about its top (or bottom) would move the other
    // edge: the transform is taken off for the measuring and put back after it.
    const bare = () => {
      el.style.transform = "";
    };
    ScrollTrigger.addEventListener("refreshInit", bare);
    ScrollTrigger.addEventListener("refresh", apply);

    const rising = ScrollTrigger.create({
      trigger: el,
      start: "top bottom",
      end: "top top",
      invalidateOnRefresh: true,
      onRefresh: (self) => {
        rise.current = { start: self.start, end: self.end };
      },
      onUpdate: (self) => {
        up = self.progress;
        apply();
      },
    });
    const leaving = ScrollTrigger.create({
      trigger: el,
      start: "bottom bottom",
      end: "bottom top",
      invalidateOnRefresh: true,
      onRefresh: (self) => {
        leave.current = { start: self.start, end: self.end };
      },
      onUpdate: (self) => {
        out = self.progress;
        apply();
      },
    });
    rise.current = { start: rising.start, end: rising.end };
    leave.current = { start: leaving.start, end: leaving.end };
    up = rising.progress;
    out = leaving.progress;
    apply();
    return () => {
      ScrollTrigger.removeEventListener("refreshInit", bare);
      ScrollTrigger.removeEventListener("refresh", apply);
      rising.kill();
      leaving.kill();
      rise.current = null;
      leave.current = null;
      el.style.transform = "";
      el.style.visibility = "";
      el.style.transformOrigin = "";
      el.style.borderRadius = "";
    };
  }, []);

  // A stop inside the rise or inside the leaving snaps after one second without input.
  useScrollSnap(`${id}-rise`, () => rise.current, { idleMs: 1000 });
  useScrollSnap(`${id}-leave`, () => leave.current, { idleMs: 1000 });

  return (
    <div
      ref={panel}
      id={id}
      className={[styles.rise, className].filter(Boolean).join(" ")}
      style={style}
      data-theme={theme}
    >
      <span ref={shadowTop} className={`${styles.shadow} ${styles.shadowTop}`} aria-hidden="true" />
      {children}
      <span
        ref={shadowBottom}
        className={`${styles.shadow} ${styles.shadowBottom}`}
        aria-hidden="true"
      />
    </div>
  );
}
