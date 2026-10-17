"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { ThemeZone } from "@/components/theme-zone";
import type { Contrast } from "@/content/world";
import { audio } from "@/lib/audio";
import { useReducedMotion } from "@/lib/hooks";
import { clamp } from "@/lib/math";

import { ChapterLink } from "../chapter-link";
import { chapterShort } from "../experience-href";
import type { CalmMode, StormTone } from "./ambient-scenes";
import styles from "./contrast-track.module.css";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger, useGSAP);

const AmbientCanvas = dynamic(() => import("./ambient-canvas"), { ssr: false });

export interface ContrastTrackProps {
  contrast: Contrast;
  /** 1-based position among the tracks. */
  index: number;
  total: number;
  mode: CalmMode;
  tone: StormTone;
}

/** "Dawnbreak, 978: a peaceful world" becomes a small kicker and the claim itself. */
function splitHeadline(headline: string): { kicker: string | null; claim: string } {
  const at = headline.indexOf(": ");
  if (at < 0) return { kicker: null, claim: headline };
  const claim = headline.slice(at + 2);
  return { kicker: headline.slice(0, at), claim: claim.charAt(0).toUpperCase() + claim.slice(1) };
}

const EDGE_SLANT = 7;

/**
 * One before and after. The stage is pinned with CSS `position: sticky` while the page scrolls
 * through the track, and the scroll position drives a single number, the progress p:
 *
 *   p 0.00 to 0.28  the calm statement stands, with its scene
 *   p 0.28 to 0.42  a line is struck through it and the colour drains
 *   p 0.45 to 0.80  the Storm world wipes in from the right
 *   p 0.62 to 0.87  the opposite statement rises
 *
 * Everything reads `p` through CSS variables, so nothing re-renders while scrolling. A range
 * slider moves p by hand (and is the keyboard and screen reader route), and a button holds
 * the view on "before" (press and hold, tap to latch, Enter or Space to toggle). Under reduced
 * motion there is no pinning and no scrub: the two worlds crossfade.
 */
export function ContrastTrack({ contrast, index, total, mode, tone }: ContrastTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const progress = useRef(0);
  const reduced = useReducedMotion();
  const [held, setHeld] = useState(false);

  const c = useRef({
    scroll: 0,
    override: null as number | null,
    overrideAt: 0,
    current: -1,
    raf: 0,
    last: 0,
    held: false,
    reduced: false,
  });

  const apply = useCallback((p: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const st = c.current;
    const s = clamp((p - 0.28) / 0.14);
    const w = clamp((p - 0.45) / 0.35);
    const d = clamp((p - 0.26) / 0.3);
    const r = clamp((p - 0.62) / 0.25);
    stage.style.setProperty("--s", s.toFixed(3));
    stage.style.setProperty("--d", d.toFixed(3));
    stage.style.setProperty("--r", st.reduced ? (p > 0.5 ? "1" : "0") : r.toFixed(3));
    stage.style.setProperty(
      "--edge",
      st.reduced ? `${-EDGE_SLANT - 2}%` : `${(112 - w * 124).toFixed(2)}%`,
    );
    stage.style.setProperty("--fade", st.reduced ? (p > 0.5 ? "1" : "0") : "1");
    stage.style.setProperty("--eo", !st.reduced && w > 0.004 && w < 0.996 ? "1" : "0");
    const phase = p < 0.28 ? "before" : p < 0.6 ? "turning" : "after";
    if (stage.dataset.phase !== phase) stage.dataset.phase = phase;
    const slider = sliderRef.current;
    if (slider) {
      slider.value = String(Math.round(p * 100));
      slider.style.setProperty("--p", String(p.toFixed(3)));
      slider.setAttribute(
        "aria-valuetext",
        phase === "before" ? "Before" : phase === "turning" ? "Being struck out" : "After",
      );
    }
    progress.current = p;
    stage.dispatchEvent(new Event("story:progress"));
  }, []);

  const kick = useCallback(() => {
    const st = c.current;
    if (st.raf) return;
    st.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - st.last) / 1000);
      st.last = now;
      const target = st.held ? 0 : (st.override ?? (st.reduced ? 1 : st.scroll));
      if (st.reduced || st.current < 0) st.current = target;
      else st.current += (target - st.current) * (1 - Math.exp(-9 * dt));
      if (Math.abs(target - st.current) < 0.0008) st.current = target;
      apply(st.current);
      st.raf = Math.abs(target - st.current) > 0 ? requestAnimationFrame(tick) : 0;
    };
    st.raf = requestAnimationFrame(tick);
  }, [apply]);

  useEffect(() => {
    c.current.reduced = reduced;
    c.current.current = -1;
    kick();
  }, [reduced, kick]);

  useEffect(() => {
    const st = c.current;
    return () => cancelAnimationFrame(st.raf);
  }, []);

  useGSAP(
    () => {
      const track = trackRef.current;
      if (!track || reduced) return;
      const st = c.current;
      const read = (p: number) => {
        st.scroll = p;
        if (st.override !== null && Math.abs(p - st.overrideAt) > 0.004) st.override = null;
        kick();
      };
      const trigger = ScrollTrigger.create({
        trigger: track,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => read(self.progress),
        onRefresh: (self) => read(self.progress),
      });
      return () => trigger.kill();
    },
    { scope: trackRef, dependencies: [reduced, kick] },
  );

  const setHold = (v: boolean) => {
    c.current.held = v;
    setHeld(v);
    kick();
  };
  const downAt = useRef(0);
  const latched = useRef(false);

  const onSlide = (value: number) => {
    const st = c.current;
    st.override = clamp(value / 100);
    st.overrideAt = st.scroll;
    if (st.held) {
      latched.current = false;
      setHold(false);
    }
    kick();
  };

  const onSliderKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const dir =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? -1
          : 0;
    if (!dir) return;
    e.preventDefault();
    const now = Number(e.currentTarget.value);
    onSlide(clamp(now + dir * 5, 0, 100));
  };

  const before = splitHeadline(contrast.before.headline);
  const after = splitHeadline(contrast.after.headline);
  const num = String(index).padStart(2, "0");

  return (
    <div ref={trackRef} className={styles.track} data-reduced={reduced} data-track={contrast.id}>
      <div
        ref={stageRef}
        className={styles.stage}
        data-phase="before"
        data-tone={tone}
        role="group"
        aria-labelledby={`${contrast.id}-label`}
      >
        <ThemeZone theme="daybreak" as="div" className={styles.calm}>
          <AmbientCanvas
            world="calm"
            mode={mode}
            tone={tone}
            progress={progress}
            className={styles.canvas}
          />
          <div className={styles.copy}>
            {before.kicker && <p className={`${styles.kicker} hud-label`}>{before.kicker}</p>}
            <p className={styles.claim}>
              <s className={styles.strike}>{before.claim}</s>
            </p>
            <blockquote className={styles.quote}>{contrast.before.quote}</blockquote>
          </div>
        </ThemeZone>

        <ThemeZone theme="storm" as="div" className={styles.storm}>
          <AmbientCanvas
            world="storm"
            mode={mode}
            tone={tone}
            progress={progress}
            className={styles.canvas}
          />
          <div className={styles.copy}>
            {after.kicker && <p className={`${styles.kicker} hud-label`}>{after.kicker}</p>}
            <p className={styles.echo} aria-hidden="true">
              <s>{before.claim}</s>
            </p>
            <p className={styles.after}>{after.claim}</p>
            <blockquote className={styles.quote}>{contrast.after.quote}</blockquote>
          </div>
        </ThemeZone>

        <div className={styles.edge} aria-hidden="true">
          <span className={styles.edgeGlow} />
          <span className={styles.edgeLine} />
        </div>

        <div className={styles.top}>
          <p id={`${contrast.id}-label`} className={`${styles.label} hud-label`}>
            <span>
              {num} / {String(total).padStart(2, "0")}
            </span>
            <span>{contrast.place}</span>
          </p>
        </div>

        <ThemeZone theme="storm" as="div" surface={false} className={styles.bar}>
          <button
            type="button"
            className={styles.hold}
            aria-pressed={held}
            data-cursor="HOLD"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              downAt.current = performance.now();
              audio.blip("click");
              setHold(true);
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerUp={() => {
              const quick = performance.now() - downAt.current < 260;
              if (latched.current) {
                latched.current = false;
                setHold(false);
              } else if (quick) {
                latched.current = true;
              } else {
                setHold(false);
              }
            }}
            onPointerCancel={() => {
              latched.current = false;
              setHold(false);
            }}
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => {
              if (e.detail !== 0) return;
              latched.current = !held;
              setHold(!held);
              audio.blip("click");
            }}
          >
            <span className={styles.holdDot} aria-hidden="true" />
            {held ? "Release for after" : "Hold to see before"}
          </button>

          <label className={styles.sliderWrap}>
            <span className={styles.sliderEnd}>Before</span>
            <input
              ref={sliderRef}
              type="range"
              min={0}
              max={100}
              step={1}
              defaultValue={0}
              className={styles.slider}
              aria-label={`${contrast.place}: compare before and after`}
              onInput={(e) => onSlide(Number(e.currentTarget.value))}
              onKeyDown={onSliderKey}
            />
            <span className={styles.sliderEnd}>After</span>
          </label>

          <div className={styles.sources}>
            <ChapterLink
              id={contrast.before.chapterId}
            >{`Before ${chapterShort(contrast.before.chapterId)}`}</ChapterLink>
            {contrast.after.chapterId !== contrast.before.chapterId && (
              <ChapterLink
                id={contrast.after.chapterId}
              >{`After ${chapterShort(contrast.after.chapterId)}`}</ChapterLink>
            )}
          </div>
        </ThemeZone>
      </div>
    </div>
  );
}
