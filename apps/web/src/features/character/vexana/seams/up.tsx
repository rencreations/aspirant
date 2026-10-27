"use client";

import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, type ReactNode } from "react";

import styles from "./up.module.css";
import { boundary } from "./gates";
import { lvh } from "./scroll-kit";
import { useScrollSnap } from "./snap";

interface UpZoneProps {
  /** The boundary in front of this section (the section before it passes the same id to `Gate`). */
  id: string;
  /** Screens of scrolling the first screen is held for when the visitor goes back up. */
  hold: number;
  /** The share of the hold at which the transition back starts by itself. */
  at: number;
  /** False (reduced motion): the section is shown as it is. */
  enabled?: boolean;
  /** Quiet time, in ms, after which a stop in the stretch snaps. Default: the page's 1500. */
  idleMs?: number;
  children: ReactNode;
}

/**
 * The way back of a boundary. The first screen of the section is held for `hold` screens, but
 * only for the visitor who scrolls UP into it from below: the transition down jumps past this
 * stretch, so arriving here by scrolling down has no threshold at all. Scrolling up through it
 * goes through a threshold; at the threshold (or after a stop in the second half)
 * the scene of the boundary plays again and the page goes back to the last screen of the
 * section before, which has no threshold above it.
 */
export function UpZone({ id, hold, at, enabled = true, idleMs, children }: UpZoneProps) {
  const root = useRef<HTMLDivElement>(null);
  const stick = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const span = useRef<{ start: number; end: number } | null>(null);
  const state = useRef({ armed: true, last: 1 });

  useEffect(() => {
    if (!enabled) return;
    const r = root.current;
    const s = stick.current;
    const back = backdrop.current;
    if (!r || !s || !back) return;
    const b = boundary(id);
    const st = ScrollTrigger.create({
      trigger: r,
      start: "top top",
      end: () => `+=${String(hold * lvh())}`,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        tick(self.progress);
      },
      onRefresh: (self) => {
        span.current = { start: self.start, end: self.end };
        tick(self.progress);
      },
    });
    span.current = { start: st.start, end: st.end };
    // ScrollTrigger measures what is inside the box (the section's own gate, its triggers) with the
    // page at rest. The pinned box would be measured at the top of its wrapper, `hold` screens above
    // the place it ends up in; so while it measures, the box stands where it ends up.
    const rest = () => {
      s.style.position = "relative";
      s.style.top = `${String(hold * lvh())}px`;
    };
    const unrest = () => {
      s.style.position = "";
      s.style.top = "";
    };
    ScrollTrigger.addEventListener("refreshInit", rest);
    ScrollTrigger.addEventListener("refresh", unrest);
    // Going up, the progress falls from 1 (the first screen of the section) to 0.
    function tick(p: number) {
      const t = state.current;
      if (p > 1 - at + 0.2) t.armed = true;
      if (p <= 1 - at && p > 0 && p < t.last && t.armed && !b.busy) {
        t.armed = false;
        b.play?.("up");
      }
      t.last = p;
    }
    b.up = { held: s, backdrop: back, range: () => span.current };
    return () => {
      ScrollTrigger.removeEventListener("refreshInit", rest);
      ScrollTrigger.removeEventListener("refresh", unrest);
      unrest();
      st.kill();
      span.current = null;
      if (b.up?.held === s) b.up = null;
    };
  }, [enabled, id, hold, at]);

  // Stopping in the stretch: from the half on the way back goes on by itself, before it the page
  // returns to the first screen. The range runs backwards: it starts at the section's own start.
  useScrollSnap(
    `${id}:up`,
    () => {
      const r = span.current;
      return r && !boundary(id).busy ? { start: r.end, end: r.start } : null;
    },
    {
      enabled,
      idleMs,
      onSnap: (side) => {
        if (side !== "end") return false;
        const b = boundary(id);
        if (b.busy || !b.play) return false;
        state.current.armed = false;
        b.play("up");
        return true;
      },
    },
  );

  if (!enabled) return <>{children}</>;

  return (
    <div ref={root} className={styles.root} style={{ ["--hold" as string]: hold }}>
      <div ref={backdrop} className={styles.backdrop} aria-hidden="true" />
      <div ref={stick} className={styles.stick}>
        {children}
      </div>
      <div className={styles.spacer} />
    </div>
  );
}
