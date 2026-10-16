"use client";

import { useEffect, useRef } from "react";

import { prefersReducedMotion } from "@/lib/hooks";

import styles from "./text-effects.module.css";

export interface TypewriterProps {
  /** The text to type. */
  text: string;
  /** Element to render. Default "span". */
  as?: keyof HTMLElementTagNameMap;
  /** Characters per second. Default 38. */
  speed?: number;
  /** Seconds to wait before typing. Default 0. */
  startDelay?: number;
  /** Start on mount or when scrolled into view (default). */
  trigger?: "mount" | "inview";
  /** Show the blinking block caret. Default true. */
  caret?: boolean;
  className?: string;
  /** Called once the whole text is typed. */
  onDone?: () => void;
}

/**
 * Types text out like a terminal, with a blinking block caret. Screen readers get the full
 * text at once (sr-only copy); the typed copy is aria-hidden. Reduced motion shows the whole
 * text immediately. The rAF loop pauses with the tab and stops when done.
 *
 * <Typewriter text="Resonance link established." trigger="mount" />
 */
export function Typewriter({
  text,
  as,
  speed = 38,
  startDelay = 0,
  trigger = "inview",
  caret = true,
  className,
  onDone,
}: TypewriterProps) {
  // Typed as a single intrinsic tag (HTMLElement props): an ElementType union breaks once
  // @react-three/fiber augments JSX.IntrinsicElements.
  const Tag = (as ?? "span") as "span";
  const rootRef = useRef<HTMLElement>(null);
  const typedRef = useRef<HTMLSpanElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    const root = rootRef.current;
    const typed = typedRef.current;
    if (!root || !typed) return;
    const chars = Array.from(text);
    const finish = () => {
      typed.textContent = text;
      caretRef.current?.setAttribute("data-done", "true");
      doneRef.current?.();
    };
    root.removeAttribute("data-typing-pending");
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    typed.textContent = "";
    caretRef.current?.setAttribute("data-done", "false");

    let raf = 0;
    let begin = 0;
    let shown = 0;
    const tick = (now: number) => {
      if (!begin) begin = now + startDelay * 1000;
      const n = Math.max(0, Math.floor(((now - begin) / 1000) * speed));
      if (n !== shown) {
        shown = Math.min(n, chars.length);
        typed.textContent = chars.slice(0, shown).join("");
      }
      if (shown >= chars.length) {
        raf = 0;
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    let observer: IntersectionObserver | null = null;
    if (trigger === "mount" || typeof IntersectionObserver === "undefined") start();
    else {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer?.disconnect();
          start();
        }
      });
      observer.observe(root);
    }
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [text, speed, startDelay, trigger]);

  return (
    <Tag ref={rootRef} className={className} data-typing-pending="">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        <span ref={typedRef} className={styles.typed}>
          {text}
        </span>
        {caret && <span ref={caretRef} className={styles.caret} data-done="false" />}
      </span>
    </Tag>
  );
}
