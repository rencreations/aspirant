"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { facesGate, toneHint } from "./gates";
import { useHold, useHoldProgress } from "./hold";
import { easeInOut, put, seg } from "./scroll-kit";
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
      },
    }),
    [],
  );

  return (
    <div className={`${styles.doors} ${styles[tone] ?? ""}`} aria-hidden="true">
      <div ref={left} className={`${styles.door} ${styles.left}`} />
      <div ref={right} className={`${styles.door} ${styles.right}`} />
    </div>
  );
});

/**
 * The craft to the pair of faces. The last screen of the craft is held. Then two pale doors close
 * from the left and the right and meet, the craft is hidden behind them, and the doors fade away
 * on the pair of faces, which is already in place under them (the same pale colour), so there is
 * never a gap. The pair then arrives from the two sides (`facesGate`).
 */
export function CraftDoors() {
  const doors = useRef<DoorsApi>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const { hideContent } = useHold();
  const hidden = useRef(false);

  useHoldProgress((p) => {
    doors.current?.set(easeInOut(seg(p, 0.1, 0.45)));
    const hide = p >= 0.45;
    if (hide !== hidden.current) {
      hidden.current = hide;
      hideContent(hide);
    }
    put(wrap.current, "opacity", (1 - easeInOut(seg(p, 0.6, 0.78))).toFixed(3));
    facesGate.set(p >= 0.58);
    // The right door is over the corner once it has closed a little; the pair of faces under the
    // doors is pale too, so the hint can stay until the doors have faded.
    toneHint.set(p > 0.1 && p < 0.78 && easeInOut(seg(p, 0.1, 0.45)) >= 0.2 ? "light" : null);
  });

  useEffect(
    () => () => {
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
