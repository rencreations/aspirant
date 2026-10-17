"use client";

import gsap from "gsap";
import { useEffect, useRef, type PointerEvent } from "react";

import { prefersReducedMotion } from "@/lib/hooks";
import { springs, springStep } from "@/lib/motion";

import styles from "./hero.module.css";

interface Letter {
  el: HTMLSpanElement;
  cx: number;
  cy: number;
  x: { x: number; v: number };
  y: { x: number; v: number };
  r: { x: number; v: number };
}

const LINES = [
  { text: "The", className: styles.titleSmall },
  { text: "Aspirants", className: styles.titleBig },
] as const;

const RADIUS = 120;

/**
 * The page's h1. Letters rise from a mask when `play` turns true (after the loader), and
 * scatter away from the pointer or finger and spring back. Two layers per letter so the
 * reveal (outer span, GSAP) and the scatter (inner span, springs) never fight. Screen
 * readers get "The Aspirants" once. Static under reduced motion.
 */
export function HeroTitle({ id, play }: { id: string; play: boolean }) {
  const rootRef = useRef<HTMLHeadingElement>(null);
  const letters = useRef<Letter[]>([]);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !play) return;
    const outers = root.querySelectorAll<HTMLElement>("[data-rise]");
    if (prefersReducedMotion()) {
      root.dataset.state = "done";
      return;
    }
    root.dataset.state = "revealing";
    const tween = gsap.fromTo(
      outers,
      { yPercent: 118, rotate: 7, opacity: 0 },
      {
        yPercent: 0,
        rotate: 0,
        opacity: 1,
        duration: 1.15,
        ease: "expo.out",
        stagger: 0.045,
        onComplete: () => {
          root.dataset.state = "done";
        },
      },
    );
    return () => {
      tween.kill();
      gsap.set(outers, { clearProps: "transform,opacity" });
      root.dataset.state = "done";
    };
  }, [play]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const measure = () => {
    const root = rootRef.current;
    if (!root) return;
    const rootRect = root.getBoundingClientRect();
    const prev = letters.current;
    letters.current = Array.from(
      root.querySelectorAll<HTMLSpanElement>("[data-letter]"),
      (el, i) => {
        const r = el.getBoundingClientRect();
        return {
          el,
          cx: r.left - rootRect.left + r.width / 2,
          cy: r.top - rootRect.top + r.height / 2,
          x: prev[i]?.x ?? { x: 0, v: 0 },
          y: prev[i]?.y ?? { x: 0, v: 0 },
          r: prev[i]?.r ?? { x: 0, v: 0 },
        };
      },
    );
  };

  const loop = () => {
    if (raf.current) return;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = pointer.current;
      let moving = false;
      for (const l of letters.current) {
        let tx = 0;
        let ty = 0;
        let tr = 0;
        if (p) {
          const dx = l.cx - p.x;
          const dy = l.cy - p.y;
          const d = Math.hypot(dx, dy) || 1;
          const f = Math.max(0, 1 - d / RADIUS);
          const push = f * f * RADIUS * 0.5;
          tx = (dx / d) * push;
          ty = (dy / d) * push;
          tr = f * 22 * Math.sign(dx || 1);
        }
        springStep(l.x, tx, dt, springs.soft);
        springStep(l.y, ty, dt, springs.soft);
        springStep(l.r, tr, dt, springs.soft);
        l.el.style.transform = `translate3d(${l.x.x.toFixed(2)}px, ${l.y.x.toFixed(2)}px, 0) rotate(${l.r.x.toFixed(2)}deg)`;
        if (
          Math.abs(l.x.x - tx) + Math.abs(l.y.x - ty) + Math.abs(l.r.x - tr) > 0.05 ||
          Math.abs(l.x.v) + Math.abs(l.y.v) > 0.05
        )
          moving = true;
      }
      raf.current = moving || p ? requestAnimationFrame(frame) : 0;
    };
    raf.current = requestAnimationFrame(frame);
  };

  const onMove = (e: PointerEvent<HTMLHeadingElement>) => {
    if (prefersReducedMotion()) return;
    const root = rootRef.current;
    if (!root) return;
    if (!raf.current || !letters.current.length) measure();
    const rect = root.getBoundingClientRect();
    pointer.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    loop();
  };

  const onLeave = () => {
    pointer.current = null;
    if (letters.current.length) loop();
  };

  return (
    <h1
      ref={rootRef}
      id={id}
      className={styles.title}
      data-state="pending"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onPointerCancel={onLeave}
      onPointerUp={(e) => {
        if (e.pointerType !== "mouse") onLeave();
      }}
    >
      <span className="sr-only">The Aspirants</span>
      <span aria-hidden="true" className={styles.titleLines}>
        {LINES.map((line) => (
          <span key={line.text} className={`${styles.titleLine} ${line.className}`}>
            {Array.from(line.text.toUpperCase()).map((ch, i) => (
              <span key={i} className={styles.letterMask}>
                <span data-rise="" className={styles.letterRise}>
                  <span data-letter="" className={styles.letter}>
                    {ch}
                  </span>
                </span>
              </span>
            ))}
          </span>
        ))}
      </span>
    </h1>
  );
}
