"use client";

import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/lib/hooks";

import shared from "./shared.module.css";

const GLYPHS = "#%&*+=<>/01234567ABCDEFXZ";

/**
 * A line of text that arrives corrupted and settles, letter by letter, once `on` is true. The
 * real text is in the page from the start (and read out), only the drawn copy scrambles.
 */
export function Resolve({
  text,
  on,
  delay = 0,
  className,
}: {
  text: string;
  on: boolean;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !on || done.current) return;
    if (reduced) {
      done.current = true;
      el.textContent = text;
      el.style.opacity = "1";
      return;
    }
    const chars = [...text];
    const span = Math.min(1500, 380 + chars.length * 11);
    let raf = 0;
    let t0 = 0;
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const t = now - t0 - delay;
      if (t < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const k = Math.min(1, t / span);
      const settled = Math.floor(k * chars.length);
      let out = "";
      for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        out += i < settled || c === " " ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      el.textContent = out;
      el.style.opacity = "1";
      if (k < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        el.textContent = text;
        done.current = true;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, reduced, text, delay]);

  return (
    <>
      <span className={shared.sr}>{text}</span>
      <span ref={ref} className={className} aria-hidden="true" style={{ opacity: reduced ? 1 : 0 }}>
        {reduced ? text : ""}
      </span>
    </>
  );
}
