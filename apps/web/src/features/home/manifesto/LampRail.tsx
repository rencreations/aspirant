"use client";

import { useEffect, useRef } from "react";

import { StarGlyph } from "@/components/star-glyph";
import { prefersReducedMotion } from "@/lib/hooks";
import { clamp } from "@/lib/math";

import styles from "./manifesto.module.css";

/**
 * A lantern on a rail beside the manifesto. It travels down as the section scrolls past, in
 * step with the words lighting up. Decorative; sits still at the top under reduced motion.
 */
export function LampRail() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const section = el?.closest("section");
    const target = section?.querySelector<HTMLElement>("[data-lamp-target]");
    if (!el || !section || !target || prefersReducedMotion()) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const r = target.getBoundingClientRect();
      const vh = window.innerHeight;
      // Matches LampText: from the block's top at 80 percent to its bottom at 45 percent.
      const p = clamp((vh * 0.8 - r.top) / Math.max(1, vh * 0.35 + r.height));
      el.style.setProperty("--lamp", p.toFixed(4));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    let listening = false;
    const io = new IntersectionObserver(([entry]) => {
      const on = entry?.isIntersecting ?? false;
      if (on && !listening) {
        listening = true;
        window.addEventListener("scroll", schedule, { passive: true });
        schedule();
      } else if (!on && listening) {
        listening = false;
        window.removeEventListener("scroll", schedule);
      }
    });
    io.observe(section);
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className={styles.rail} aria-hidden="true">
      <span className={styles.railTrack} />
      <span className={styles.railLit} />
      <span className={styles.lamp}>
        <StarGlyph className={styles.lampStar} />
      </span>
    </div>
  );
}
