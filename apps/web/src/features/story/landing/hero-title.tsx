"use client";

import { useEffect, useRef, type CSSProperties, type PointerEvent } from "react";

import { audio } from "@/lib/audio";
import { springs, springStep } from "@/lib/motion";

import styles from "./hero.module.css";

const WORDS = ["ASPIRANT", "STORY"] as const;

interface Glyph {
  el: HTMLElement;
  /** Centre of the letter on the screen (the hero is pinned, so it stays put while it is shown). */
  cx: number;
  cy: number;
  y: { x: number; v: number };
  s: { x: number; v: number };
  tx: { x: number; v: number };
}

/** How far the pointer lifts the letters, in letter heights, and how far a click's wave travels (px per ms). */
const REACH = 2.1;
const WAVE_SPEED = 1.4;

/**
 * The big title of the story page: "ASPIRANT STORY", white on the film, always readable. The letters
 * near the pointer (or a finger dragged over them) rise and grow a little and lean towards it, and
 * settle back when it goes. A press sends a wave out from where it landed: each letter jumps in turn,
 * the nearest first. Only `transform` is written, on the letters' own elements, and the loop runs
 * only while something moves. The letters come in one after the other when `play` turns true.
 * The title stays one string for assistive technology.
 */
export function HeroTitle({ play }: { play: boolean }) {
  const root = useRef<HTMLHeadingElement>(null);
  const glyphs = useRef<Glyph[]>([]);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const raf = useRef(0);
  const timers = useRef<number[]>([]);

  const measure = () => {
    const el = root.current;
    if (!el) return;
    const prev = glyphs.current;
    glyphs.current = Array.from(el.querySelectorAll<HTMLElement>("[data-glyph]"), (g, i) => {
      const r = g.getBoundingClientRect();
      return {
        el: g,
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
        y: prev[i]?.y ?? { x: 0, v: 0 },
        s: prev[i]?.s ?? { x: 0, v: 0 },
        tx: prev[i]?.tx ?? { x: 0, v: 0 },
      };
    });
  };

  const run = () => {
    if (raf.current) return;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = pointer.current;
      let busy = p !== null;
      for (const g of glyphs.current) {
        const h = g.el.offsetHeight || 100;
        let ty = 0;
        let ts = 0;
        let tx = 0;
        if (p) {
          const dx = p.x - g.cx;
          const dy = p.y - g.cy;
          const d = Math.hypot(dx, dy);
          const f = Math.max(0, 1 - d / (h * REACH));
          const e = f * f;
          ty = -e * h * 0.16;
          ts = e * 0.16;
          tx = (d > 1 ? dx / d : 0) * e * h * 0.05;
        }
        springStep(g.y, ty, dt, springs.soft);
        springStep(g.s, ts, dt, springs.soft);
        springStep(g.tx, tx, dt, springs.soft);
        g.el.style.transform = `translate3d(${g.tx.x.toFixed(2)}px, ${g.y.x.toFixed(2)}px, 0) scale(${(1 + g.s.x).toFixed(4)})`;
        if (
          Math.abs(g.y.x - ty) + Math.abs(g.s.x - ts) * 100 + Math.abs(g.tx.x - tx) > 0.05 ||
          Math.abs(g.y.v) + Math.abs(g.s.v) * 100 + Math.abs(g.tx.v) > 0.05
        )
          busy = true;
      }
      raf.current = busy ? requestAnimationFrame(frame) : 0;
    };
    raf.current = requestAnimationFrame(frame);
  };

  const track = (e: PointerEvent<HTMLElement>) => {
    if (!pointer.current || !glyphs.current.length) measure();
    pointer.current = { x: e.clientX, y: e.clientY };
    run();
  };

  const leave = () => {
    pointer.current = null;
    run();
  };

  const press = (e: PointerEvent<HTMLElement>) => {
    measure();
    audio.blip("confirm");
    const fs = glyphs.current[0]?.el.offsetHeight ?? 100;
    for (const g of glyphs.current) {
      const d = Math.hypot(e.clientX - g.cx, e.clientY - g.cy);
      const id = window.setTimeout(() => {
        g.y.v -= fs * 9;
        g.s.v += 1.6;
        run();
      }, d / WAVE_SPEED);
      timers.current.push(id);
    }
  };

  useEffect(() => {
    const onResize = () => {
      glyphs.current = [];
    };
    window.addEventListener("resize", onResize, { passive: true });
    const pending = timers.current;
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      for (const id of pending) window.clearTimeout(id);
    };
  }, []);

  let index = 0;
  return (
    <h1
      ref={root}
      className={styles.title}
      data-play={play ? "true" : "false"}
      onPointerMove={track}
      onPointerLeave={leave}
      onPointerCancel={leave}
      onPointerDown={press}
      onPointerUp={(e) => {
        if (e.pointerType !== "mouse") leave();
      }}
    >
      <span className="sr-only">Aspirant Story</span>
      <span className={styles.words} aria-hidden="true">
        {WORDS.map((word) => (
          <span key={word} className={styles.word}>
            {Array.from(word).map((letter) => {
              const i = index++;
              return (
                <span key={i} className={styles.letter} style={{ "--i": i } as CSSProperties}>
                  <span className={styles.glyph} data-glyph="">
                    {letter}
                  </span>
                </span>
              );
            })}
          </span>
        ))}
      </span>
    </h1>
  );
}
