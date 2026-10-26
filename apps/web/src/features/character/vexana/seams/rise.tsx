"use client";

import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, type ReactNode } from "react";

import styles from "./rise.module.css";
import { useScrollSnap, type SnapRange } from "./snap";

/**
 * A section that rises over the one before it, with no threshold and nothing drawn over either of
 * them. It overlaps the last screen of that section by one screen (`margin-top: -100lvh`; that
 * section keeps its last screen stuck for that screen with a `Hold` that has no overlay), so plain
 * scrolling makes this one rise and cover it, a soft shadow thrown up onto what it covers. It is as
 * wide as the screen, and its top corners are rounded at first and sharpen slowly, then quickly:
 * the radius is `R * (1 - (p / 0.6)^3)` and is square from 60 percent of the way, so when it has
 * come all the way it covers the whole screen with no corner and no gap. The rise can never be
 * left half way: stop in it and, after a moment, it goes on from the half and goes back before it
 * (`useScrollSnap`), in both directions.
 */
export function Rise({
  id,
  enabled = true,
  children,
}: {
  id: string;
  enabled?: boolean;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const span = useRef<SnapRange | null>(null);

  useEffect(() => {
    const el = panel.current;
    if (!el || !enabled) return;
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
        // The corners sharpen slowly at first and are square from 60 percent of the way.
        const q = Math.min(1, self.progress / 0.6);
        const r = self.progress >= 1 ? 0 : radius() * (1 - q * q * q);
        el.style.borderRadius = r < 0.5 ? "0" : `${r.toFixed(1)}px ${r.toFixed(1)}px 0 0`;
      },
    });
    span.current = { start: st.start, end: st.end };
    return () => {
      st.kill();
      span.current = null;
      el.style.borderRadius = "";
    };
  }, [enabled]);

  useScrollSnap(id, () => span.current, { enabled });

  if (!enabled) return <>{children}</>;
  return (
    <div ref={panel} className={styles.rise} data-rise={id}>
      {children}
    </div>
  );
}
