"use client";

import { useRef, type CSSProperties, type PointerEvent } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { prefersReducedMotion } from "@/lib/hooks";
import { springs, springStep } from "@/lib/motion";

export interface ScatterTextProps {
  /** The text. Rendered once for assistive tech, split into letters for the effect. */
  text: string;
  /** Element to render. Default "span". */
  as?: keyof HTMLElementTagNameMap;
  /** Reach of the pointer in px. Default 90. */
  radius?: number;
  /** Push strength multiplier. Default 1. */
  strength?: number;
  className?: string;
  /** Class for each letter span. */
  letterClassName?: string;
  style?: CSSProperties;
}

interface Letter {
  el: HTMLSpanElement;
  cx: number;
  cy: number;
  x: { x: number; v: number };
  y: { x: number; v: number };
  r: { x: number; v: number };
}

/**
 * Letters scatter away from the pointer (mouse, pen or touch drag) and spring back. The
 * full text stays readable to screen readers; the letter spans are aria-hidden. Static under
 * reduced motion. Runs a rAF loop only while active.
 */
export function ScatterText({
  text,
  as,
  radius = 90,
  strength = 1,
  className,
  letterClassName,
  style,
}: ScatterTextProps) {
  const Tag = (as ?? "span") as "span";
  const rootRef = useRef<HTMLElement>(null);
  const letters = useRef<Letter[]>([]);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const raf = useRef(0);

  const measure = () => {
    const root = rootRef.current;
    if (!root) return;
    const spans = root.querySelectorAll<HTMLSpanElement>("[data-letter]");
    const prev = letters.current;
    letters.current = Array.from(spans, (el, i) => ({
      el,
      cx: el.offsetLeft + el.offsetWidth / 2,
      cy: el.offsetTop + el.offsetHeight / 2,
      x: prev[i]?.x ?? { x: 0, v: 0 },
      y: prev[i]?.y ?? { x: 0, v: 0 },
      r: prev[i]?.r ?? { x: 0, v: 0 },
    }));
  };

  const loop = () => {
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
          const f = Math.max(0, 1 - d / radius);
          const push = f * f * radius * 0.55 * strength;
          tx = (dx / d) * push;
          ty = (dy / d) * push;
          tr = f * 28 * Math.sign(dx || 1) * strength;
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
    if (!raf.current) raf.current = requestAnimationFrame(frame);
  };

  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (prefersReducedMotion()) return;
    const root = rootRef.current;
    if (!root) return;
    if (!letters.current.length || !raf.current) measure();
    const rect = root.getBoundingClientRect();
    pointer.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    loop();
  };

  const onLeave = () => {
    pointer.current = null;
    if (letters.current.length) loop();
  };

  return (
    <Tag
      ref={rootRef}
      className={cn("relative inline-block whitespace-nowrap", className)}
      style={style}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onPointerCancel={onLeave}
      onPointerUp={(e: PointerEvent<HTMLElement>) => {
        if (e.pointerType !== "mouse") onLeave();
      }}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {Array.from(text).map((ch, i) => (
          <span
            key={i}
            data-letter=""
            className={cn("inline-block will-change-transform", letterClassName)}
          >
            {ch === " " ? " " : ch}
          </span>
        ))}
      </span>
    </Tag>
  );
}
