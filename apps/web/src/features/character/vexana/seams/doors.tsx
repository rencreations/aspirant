"use client";

import gsap from "gsap";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { facesGate, toneHint } from "./gates";
import { useHold, useHoldProgress } from "./hold";
import { easeInOut, put, seg } from "./scroll-kit";
import { useScrollSnap } from "./snap";
import styles from "./doors.module.css";

export interface DoorsApi {
  /** 0 is wide open (out of sight), 1 is shut. */
  set: (closed: number) => void;
}

/**
 * The leaves of a pair of automatic doors, moved by `set`. The leaves are `transform` only, and
 * hidden while they are open, so an open pair never leaves a hairline at the edge of the screen.
 */
export const Doors = forwardRef<DoorsApi, { tone: "paper" | "comic" }>(function Doors(
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

/** The share of the hold where the doors start to close and where they have met. */
const CLOSE_FROM = 0.08;
const CLOSED = 0.5;

/**
 * The craft to the pair of faces. The last screen of the craft is held. Then two pale doors close
 * from the left and the right and meet, following the scroll: the stretch they close over can
 * never be left half way (`useScrollSnap`: from half on they go on and close, before it they open
 * again). The scroll's part ends when they have met and the craft is hidden behind them. From then
 * on it is TIME: the doors fade away on the pair of faces, which is already in place under them
 * (the same pale colour, so there is never a gap), and the pair arrives from the two sides
 * (`facesGate`), so both halves can be pressed at once, with no more scrolling.
 */
export function CraftDoors() {
  const doors = useRef<DoorsApi>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const { hideContent, range } = useHold();
  const closed = useRef(false);
  /** The shut doors have faded away: the pair underneath is the screen, so no hint is wanted. */
  const faded = useRef(false);
  const tween = useRef<gsap.core.Tween | null>(null);

  useHoldProgress((p) => {
    doors.current?.set(easeInOut(seg(p, CLOSE_FROM, CLOSED)));
    const shut = p >= CLOSED - 0.0005;
    if (shut !== closed.current) {
      closed.current = shut;
      hideContent(shut);
      facesGate.set(shut);
      tween.current?.kill();
      if (shut) {
        tween.current = gsap.to(wrap.current, {
          opacity: 0,
          duration: 0.7,
          ease: "power2.inOut",
          onComplete: () => {
            faded.current = true;
            toneHint.set(null);
          },
        });
      } else {
        tween.current = null;
        faded.current = false;
        put(wrap.current, "opacity", "1");
      }
    }
    // The right door is over the corner once it has closed a little; the pair of faces under the
    // doors is pale too, so the hint stays until the doors have faded.
    toneHint.set(
      !faded.current && p > CLOSE_FROM && easeInOut(seg(p, CLOSE_FROM, CLOSED)) >= 0.2
        ? "light"
        : null,
    );
  });

  // Never left half way: the doors are taken to shut (the pair is shown) or to open (the craft).
  useScrollSnap("craft-doors", () => {
    const r = range();
    if (!r) return null;
    const at = (p: number) => r.start + (r.end - r.start) * p;
    return { start: at(CLOSE_FROM), end: at(CLOSED) };
  });

  useEffect(
    () => () => {
      tween.current?.kill();
      toneHint.set(null);
    },
    [],
  );

  return (
    <div ref={wrap} style={{ position: "absolute", inset: 0 }}>
      <Doors ref={doors} tone="paper" />
    </div>
  );
}
