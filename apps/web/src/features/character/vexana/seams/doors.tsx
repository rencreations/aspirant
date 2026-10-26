"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

import { put, seg } from "./scroll-kit";
import styles from "./doors.module.css";

export interface DoorsApi {
  /** 0 is wide open (out of sight), 1 is shut. */
  set: (closed: number) => void;
}

/**
 * The leaves of a pair of automatic doors, moved by `set`. The leaves are `transform` only, and
 * hidden while they are open, so an open pair never leaves a hairline at the edge of the screen.
 */
export const Doors = forwardRef<DoorsApi, { tone: "paper" | "comic" | "clear" }>(function Doors(
  { tone },
  ref,
) {
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const shadeLeft = useRef<HTMLDivElement>(null);
  const shadeRight = useRef<HTMLDivElement>(null);

  useImperativeHandle(
    ref,
    (): DoorsApi => ({
      set(closed) {
        const c = Math.min(1, Math.max(0, closed));
        const shown = c > 0.0005;
        put(left.current, "visibility", shown ? "visible" : "hidden");
        put(right.current, "visibility", shown ? "visible" : "hidden");
        put(left.current, "transform", `translate3d(${(-(1 - c) * 101).toFixed(3)}%,0,0)`);
        put(right.current, "transform", `translate3d(${((1 - c) * 101).toFixed(3)}%,0,0)`);
        // The shadows each leaf throws at its edge fade out as the doors meet, so a shut pair is one
        // flat surface: a shadow left on the other leaf would show as a streak with a hard edge in the
        // middle of the screen.
        const shade = (1 - seg(c, 0.78, 1)).toFixed(3);
        put(shadeLeft.current, "opacity", shade);
        put(shadeRight.current, "opacity", shade);
      },
    }),
    [],
  );

  return (
    <div className={`${styles.doors} ${styles[tone] ?? ""}`} aria-hidden="true">
      <div ref={left} className={`${styles.door} ${styles.left}`}>
        <div ref={shadeLeft} className={styles.shade} />
      </div>
      <div ref={right} className={`${styles.door} ${styles.right}`}>
        <div ref={shadeRight} className={styles.shade} />
      </div>
    </div>
  );
});
