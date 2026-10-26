"use client";

import { useEffect, useRef } from "react";

import { prefersReducedMotion } from "@/lib/hooks";

import type { CounterView } from "../types";
import styles from "./manifesto.module.css";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The live counter strip: each number counts up from zero the first time the strip is on
 * screen. The final values are in the server HTML for screen readers and no-JS visitors;
 * the counting digits are decorative.
 */
export function Counters({ items }: { items: readonly CounterView[] }) {
  const rootRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
    const digits = Array.from(root.querySelectorAll<HTMLElement>("[data-count]"));
    for (const el of digits) el.textContent = "00";
    let raf = 0;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        let done = true;
        digits.forEach((el, i) => {
          const target = Number(el.dataset.count);
          const t = Math.min(1, Math.max(0, (now - start - i * 140) / 1400));
          const eased = 1 - (1 - t) ** 4;
          el.textContent = pad(Math.round(target * eased));
          if (t < 1) done = false;
        });
        raf = done ? 0 : requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => {
        // The last entry is how it is now (several queue up when the page is busy).
        const entry = entries[entries.length - 1];
        if (!entry?.isIntersecting) return;
        io.disconnect();
        root.dataset.live = "true";
        run();
      },
      { threshold: 0.4 },
    );
    io.observe(root);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      digits.forEach((el) => {
        el.textContent = pad(Number(el.dataset.count));
      });
    };
  }, []);

  return (
    <ul ref={rootRef} className={styles.counters} aria-label="The story in numbers">
      {items.map((item) => (
        <li key={item.label} className={styles.counter}>
          <span className={styles.counterValue}>
            <span className="sr-only">{item.value}</span>
            <span aria-hidden="true" data-count={item.value}>
              {pad(item.value)}
            </span>
          </span>
          <span className={styles.counterLabel}>{item.label}</span>
          <span className={styles.counterTicks} aria-hidden="true" />
        </li>
      ))}
    </ul>
  );
}
