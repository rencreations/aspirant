"use client";

import gsap from "gsap";
import { forwardRef, useImperativeHandle, useRef } from "react";

import type { SceneHandle } from "../gate";
import styles from "./scenes.module.css";

const V_LINES = 24;
const H_LINES = 14;

/**
 * The game to the 3D process. The game screen collapses into a bright line like a tube being
 * switched off, the line shrinks to a dot and the dot goes out. The page jumps to the workspace
 * under the black, and its grid draws itself line by line before the black lifts.
 */
export const CrtScene = forwardRef<SceneHandle>(function CrtScene(_, ref) {
  const box = useRef<HTMLDivElement>(null);
  const black = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const gridBg = useRef<HTMLDivElement>(null);
  const vLines = useRef<Array<HTMLSpanElement | null>>([]);
  const hLines = useRef<Array<HTMLSpanElement | null>>([]);

  useImperativeHandle(
    ref,
    (): SceneHandle => ({
      build(ctx) {
        const k = ctx.level === "lite" ? 0.7 : 1;
        const v = vLines.current.filter((el): el is HTMLSpanElement => !!el);
        const h = hLines.current.filter((el): el is HTMLSpanElement => !!el);
        if (ctx.backdrop) ctx.backdrop.style.background = "#000";
        gsap.set(box.current, { opacity: 1 });
        gsap.set([black.current, line.current, dot.current, gridBg.current], { opacity: 0 });
        gsap.set(line.current, { scaleX: 1 });
        gsap.set(dot.current, { scale: 1 });
        gsap.set(v, { scaleY: 0 });
        gsap.set(h, { scaleX: 0 });
        const tl = ctx.tl;
        if (ctx.held) {
          tl.set(ctx.held, { transformOrigin: ctx.pivot() }, 0);
          tl.to(ctx.held, { scaleY: 0.004, duration: 0.32 * k, ease: "power3.in" }, 0);
          tl.set(ctx.held, { visibility: "hidden" }, 0.32 * k);
        }
        tl.fromTo(line.current, { opacity: 0 }, { opacity: 1, duration: 0.12 * k }, 0.2 * k);
        tl.set(black.current, { opacity: 1 }, 0.32 * k);
        tl.to(line.current, { scaleX: 0.012, duration: 0.28 * k, ease: "power3.in" }, 0.34 * k);
        tl.to(
          dot.current,
          { opacity: 1, scale: 2.2, duration: 0.1 * k, ease: "power2.out" },
          0.58 * k,
        );
        tl.to([line.current, dot.current], { opacity: 0, duration: 0.16 * k }, 0.72 * k);
        ctx.hint(0.3 * k, "dark");
        ctx.swapAt(0.9 * k);
        tl.set(gridBg.current, { opacity: 1 }, 0.9 * k);
        tl.to(
          v,
          {
            scaleY: 1,
            duration: 0.3 * k,
            ease: "power2.out",
            stagger: { each: 0.012 * k, from: "center" },
          },
          0.92 * k,
        );
        tl.to(
          h,
          {
            scaleX: 1,
            duration: 0.3 * k,
            ease: "power2.out",
            stagger: { each: 0.016 * k, from: "center" },
          },
          0.95 * k,
        );
        tl.to(box.current, { opacity: 0, duration: 0.3 * k, ease: "power1.in" }, 1.22 * k);
      },
      reset() {
        gsap.set(box.current, { opacity: 0 });
      },
    }),
    [],
  );

  return (
    <div ref={box} className={styles.crt}>
      <div ref={gridBg} className={styles.crtGridBg}>
        {Array.from({ length: V_LINES }, (_, i) => (
          <span
            key={`v${String(i)}`}
            ref={(el) => {
              vLines.current[i] = el;
            }}
            className={styles.crtV}
            style={{ left: `${String(((i + 0.5) / V_LINES) * 100)}%` }}
          />
        ))}
        {Array.from({ length: H_LINES }, (_, i) => (
          <span
            key={`h${String(i)}`}
            ref={(el) => {
              hLines.current[i] = el;
            }}
            className={styles.crtH}
            style={{ top: `${String(((i + 0.5) / H_LINES) * 100)}%` }}
          />
        ))}
      </div>
      <div ref={black} className={styles.crtBlack} />
      <div ref={line} className={styles.crtLine} />
      <div ref={dot} className={styles.crtDot} />
    </div>
  );
});
