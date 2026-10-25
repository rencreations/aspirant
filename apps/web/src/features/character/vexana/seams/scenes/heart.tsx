"use client";

import gsap from "gsap";
import { forwardRef, useImperativeHandle, useRef } from "react";

import type { SceneHandle } from "../gate";
import styles from "./scenes.module.css";

const HEART = "M50 86 C8 56 -2 30 14 14 C28 1 45 9 50 24 C55 9 72 1 86 14 C102 30 92 56 50 86 Z";

/**
 * Her theme to her best friend. A heart (Guinevere's pink) comes up in the middle of the music film,
 * which draws back and dims, and beats twice with rings spreading from it. Then it swells until it
 * fills the screen, followed by a second heart in her cream, which is the colour of her section.
 * The page jumps there under the cream, and the cream lifts.
 */
export const HeartScene = forwardRef<SceneHandle>(function HeartScene(_, ref) {
  const pink = useRef<HTMLDivElement>(null);
  const cream = useRef<HTMLDivElement>(null);
  const cover = useRef<HTMLDivElement>(null);
  const rings = useRef<Array<HTMLSpanElement | null>>([]);

  useImperativeHandle(
    ref,
    (): SceneHandle => ({
      build(ctx) {
        const k = ctx.level === "lite" ? 0.7 : 1;
        const tl = ctx.tl;
        const r = rings.current.filter((el): el is HTMLSpanElement => !!el);
        gsap.set([pink.current, cream.current], {
          xPercent: -50,
          yPercent: -50,
          scale: 0,
          opacity: 1,
        });
        gsap.set(cover.current, { opacity: 0 });
        gsap.set(r, { xPercent: -50, yPercent: -50, scale: 1, opacity: 0 });
        if (ctx.held) {
          tl.set(ctx.held, { transformOrigin: ctx.pivot() }, 0);
          tl.to(ctx.held, { scale: 0.985, opacity: 0.6, duration: 0.4 * k, ease: "power2.out" }, 0);
          tl.to(ctx.held, { scale: 1, duration: 0.12 * k, ease: "power2.out" }, 0.4 * k);
          tl.to(ctx.held, { scale: 0.975, duration: 0.1 * k }, 0.58 * k);
          tl.to(ctx.held, { scale: 1, duration: 0.16 * k }, 0.68 * k);
        }
        tl.to(pink.current, { scale: 1, duration: 0.4 * k, ease: "back.out(2)" }, 0);
        // The two beats, with a ring spreading from each.
        const beat = (at: number, size: number, ring: number) => {
          tl.to(pink.current, { scale: size, duration: 0.1 * k, ease: "power2.out" }, at * k);
          tl.to(
            pink.current,
            { scale: 1, duration: 0.15 * k, ease: "power2.inOut" },
            (at + 0.1) * k,
          );
          const el = r[ring];
          if (el) {
            tl.fromTo(
              el,
              { scale: 1, opacity: 0.75 },
              { scale: 2.8, opacity: 0, duration: 0.6 * k, ease: "power2.out" },
              at * k,
            );
          }
        };
        beat(0.42, 1.22, 0);
        beat(0.6, 1.32, 1);
        // The swell.
        tl.to(pink.current, { scale: 17, duration: 0.7 * k, ease: "power3.in" }, 0.88 * k);
        tl.fromTo(
          cream.current,
          { scale: 0 },
          { scale: 1, duration: 0.2 * k, ease: "power2.out" },
          0.86 * k,
        );
        tl.to(cream.current, { scale: 17, duration: 0.7 * k, ease: "power3.in" }, 1.0 * k);
        ctx.hint(1.35 * k, "light");
        tl.to(cover.current, { opacity: 1, duration: 0.15 * k }, 1.5 * k);
        ctx.swapAt(1.66 * k);
        tl.to([pink.current, cream.current], { opacity: 0, duration: 0.05 * k }, 1.7 * k);
        tl.to(cover.current, { opacity: 0, duration: 0.45 * k, ease: "power2.out" }, 1.72 * k);
      },
      reset() {
        gsap.set([pink.current, cream.current, cover.current], { opacity: 0 });
      },
    }),
    [],
  );

  return (
    <div className={styles.heartBox}>
      <span
        ref={(el) => {
          rings.current[0] = el;
        }}
        className={styles.ring}
      />
      <span
        ref={(el) => {
          rings.current[1] = el;
        }}
        className={styles.ring}
      />
      <div ref={pink} className={styles.heart} data-tone="pink">
        <svg viewBox="-2 0 104 90" focusable="false">
          <path d={HEART} />
        </svg>
      </div>
      <div ref={cream} className={styles.heart} data-tone="cream">
        <svg viewBox="-2 0 104 90" focusable="false">
          <path d={HEART} />
        </svg>
      </div>
      <div ref={cover} className={styles.heartCover} />
    </div>
  );
});
