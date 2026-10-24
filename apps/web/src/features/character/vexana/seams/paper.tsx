"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, type ReactNode } from "react";

import { useHoldProgress } from "./hold";
import { easeOut, put, seg } from "./scroll-kit";
import styles from "./paper.module.css";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/** The film dims a little as the craft is laid over it. */
export function Veil() {
  const veil = useRef<HTMLDivElement>(null);
  useHoldProgress((p) => {
    put(veil.current, "opacity", (0.55 * seg(p, 0.1, 0.95)).toFixed(3));
  });
  return <div ref={veil} className={styles.veil} aria-hidden="true" />;
}

/**
 * A sheet laid over the section before it. The wrapper overlaps the held screen of that section by
 * `overlap` screens (the length of its hold), so plain scrolling lifts the sheet over it: a bright
 * rim along the top edge, a shadow thrown up onto what it covers, and a slight tilt that settles
 * flat by the time the sheet reaches the top, like a page being put down.
 */
export function Paper({
  overlap,
  enabled = true,
  children,
}: {
  overlap: number;
  enabled?: boolean;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sheet.current;
    if (!el || !enabled) return;
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top bottom",
      end: "top top",
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const e = easeOut(self.progress);
        // Flat (no transform at all) before it begins and once it has landed.
        el.style.transform =
          self.progress <= 0 || self.progress >= 1
            ? ""
            : `rotate(${(-1.25 * (1 - e)).toFixed(3)}deg)`;
      },
    });
    return () => {
      st.kill();
      el.style.transform = "";
    };
  }, [enabled]);

  if (!enabled) return <>{children}</>;
  return (
    <div ref={sheet} className={styles.paper} style={{ ["--overlap" as string]: overlap }}>
      {children}
    </div>
  );
}
