"use client";

import gsap from "gsap";
import { forwardRef, useImperativeHandle, useRef } from "react";

import type { SceneHandle } from "../gate";
import styles from "./scenes.module.css";

/** Where each frame hangs, in percent of the screen, and how it sits. */
const FRAMES = [
  { x: 5, y: 14, w: 19, h: 34, r: -4, a: "#2a1550", b: "#7a4fd6" },
  { x: 27, y: 7, w: 14, h: 21, r: 3, a: "#3a1030", b: "#e040a0" },
  { x: 44, y: 20, w: 22, h: 30, r: -2, a: "#14233f", b: "#b79cf2" },
  { x: 70, y: 9, w: 15, h: 25, r: 4, a: "#2a1550", b: "#e040a0" },
  { x: 76, y: 43, w: 18, h: 30, r: -3, a: "#3a1030", b: "#7a4fd6" },
  { x: 12, y: 55, w: 24, h: 28, r: 2, a: "#14233f", b: "#7a4fd6" },
  { x: 42, y: 57, w: 17, h: 26, r: -5, a: "#2a1550", b: "#b79cf2" },
];

/**
 * The 3D process to the gallery. The workspace turns away on its side and fades, and picture frames
 * drop in on their wires, each swinging to rest on the wall. The page jumps to the gallery behind
 * the wall, and the frames are lifted off again, one after the other, to show it.
 */
export const WallScene = forwardRef<SceneHandle>(function WallScene(_, ref) {
  const box = useRef<HTMLDivElement>(null);
  const bg = useRef<HTMLDivElement>(null);
  const frames = useRef<Array<HTMLDivElement | null>>([]);

  useImperativeHandle(
    ref,
    (): SceneHandle => ({
      build(ctx) {
        const k = ctx.level === "lite" ? 0.7 : 1;
        const fr = frames.current.filter((el): el is HTMLDivElement => !!el);
        if (ctx.backdrop) ctx.backdrop.style.background = "#0b0716";
        gsap.set(box.current, { opacity: 1 });
        gsap.set(bg.current, { opacity: 0 });
        const tl = ctx.tl;
        if (ctx.held) {
          tl.set(ctx.held, { transformOrigin: ctx.pivot(), transformPerspective: 1100 }, 0);
          tl.to(
            ctx.held,
            {
              rotationY: -30,
              x: -ctx.vw * 0.1,
              scale: 0.86,
              opacity: 0,
              duration: 0.7 * k,
              ease: "power2.in",
            },
            0,
          );
        }
        fr.forEach((el, i) => {
          const f = FRAMES[i];
          if (!f) return;
          const start = (0.22 + i * 0.07) * k;
          gsap.set(el, { y: -ctx.vh * 1.4, rotation: i % 2 ? 9 : -9 });
          tl.to(el, { y: 0, duration: 0.62 * k, ease: "power3.out" }, start);
          tl.to(el, { rotation: f.r, duration: 1.0 * k, ease: "elastic.out(1, 0.35)" }, start);
          tl.to(
            el,
            { y: -ctx.vh * 1.4, duration: 0.45 * k, ease: "power2.in" },
            (1.0 + i * 0.04) * k,
          );
        });
        tl.to(bg.current, { opacity: 1, duration: 0.15 * k }, 0.68 * k);
        ctx.hint(0, "dark");
        ctx.swapAt(0.92 * k);
        tl.to(bg.current, { opacity: 0, duration: 0.35 * k, ease: "power1.out" }, 1.25 * k);
      },
      reset() {
        gsap.set(box.current, { opacity: 0 });
      },
    }),
    [],
  );

  return (
    <div ref={box} className={styles.wall}>
      <div ref={bg} className={styles.wallBg} />
      {FRAMES.map((f, i) => (
        <div
          key={i}
          ref={(el) => {
            frames.current[i] = el;
          }}
          className={styles.wallFrame}
          style={{
            left: `${String(f.x)}%`,
            top: `${String(f.y)}%`,
            width: `${String(f.w)}%`,
            height: `${String(f.h)}%`,
            background: `linear-gradient(150deg, ${f.a}, ${f.b})`,
          }}
        />
      ))}
    </div>
  );
});
