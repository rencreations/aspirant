"use client";

import gsap from "gsap";
import { forwardRef, useImperativeHandle, useRef } from "react";

import type { SceneHandle } from "../gate";
import styles from "./scenes.module.css";

const BLADES = 8;

/**
 * Her best friend to the room. The screen closes like the aperture of a lens: eight blades slide in
 * and turn a little until the hole is gone. If the room's videos are not here yet the lens stays
 * shut and a thin line fills with the real progress of their download. Then the page jumps to the
 * room under the shut lens, and the lens opens on it.
 */
export const IrisScene = forwardRef<SceneHandle>(function IrisScene(_, ref) {
  const arms = useRef<Array<HTMLDivElement | null>>([]);
  const blades = useRef<Array<HTMLSpanElement | null>>([]);
  const loader = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLSpanElement>(null);

  useImperativeHandle(
    ref,
    (): SceneHandle => ({
      build(ctx) {
        const k = ctx.level === "lite" ? 0.7 : 1;
        const tl = ctx.tl;
        const a = arms.current.filter((el): el is HTMLDivElement => !!el);
        const b = blades.current.filter((el): el is HTMLSpanElement => !!el);
        // Open: the octagon's inradius reaches the corners of the screen.
        const open = 0.52 * Math.hypot(ctx.vw, ctx.vh);
        const shut = -4;
        gsap.set(b, { x: open, opacity: 1 });
        a.forEach((el, i) => {
          gsap.set(el, { rotation: i * (360 / BLADES) });
        });
        gsap.set(loader.current, { opacity: 0 });
        gsap.set(fill.current, { scaleX: 0 });
        if (ctx.held) {
          tl.set(ctx.held, { transformOrigin: ctx.pivot() }, 0);
          tl.to(ctx.held, { scale: 1.08, duration: 0.9 * k, ease: "power2.in" }, 0);
        }
        tl.to(b, { x: shut, duration: 0.9 * k, ease: "power3.in" }, 0);
        tl.to(a, { rotation: "+=22", duration: 0.9 * k, ease: "power3.in" }, 0);
        // The corner turns dark when the hole's edge passes the nav text.
        const corner = Math.hypot(ctx.vw / 2 - 90, ctx.vh / 2 - 30);
        const closing = 0.9 * k * Math.pow(Math.max(0, 1 - corner / open), 1 / 3);
        ctx.hint(closing, "dark");
        ctx.swapAt(1.0 * k);
        tl.to(b, { x: open, duration: 1.0 * k, ease: "power3.out" }, 1.05 * k);
        tl.to(a, { rotation: "-=22", duration: 1.0 * k, ease: "power3.out" }, 1.05 * k);
        // On the way out the corner is clear again when the hole has grown past it.
        const q = (corner + 4) / (open + 4);
        ctx.hint(1.05 * k + (1 - Math.pow(Math.max(0, 1 - q), 1 / 3)) * 1.0 * k, null);
      },
      reset() {
        gsap.set(
          blades.current.filter((el): el is HTMLSpanElement => !!el),
          { opacity: 0 },
        );
        gsap.set(loader.current, { opacity: 0 });
      },
      loading(show) {
        gsap.to(loader.current, { opacity: show ? 1 : 0, duration: 0.25 });
      },
      progress(f) {
        gsap.to(fill.current, {
          scaleX: Math.min(1, Math.max(0, f)),
          duration: 0.2,
          overwrite: true,
        });
      },
    }),
    [],
  );

  return (
    <div className={styles.iris}>
      {Array.from({ length: BLADES }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            arms.current[i] = el;
          }}
          className={styles.arm}
        >
          <span
            ref={(el) => {
              blades.current[i] = el;
            }}
            className={styles.blade}
          />
        </div>
      ))}
      <div ref={loader} className={styles.irisLoad}>
        <span className={styles.irisText}>Loading her room</span>
        <span className={styles.irisTrack}>
          <span ref={fill} className={styles.irisFill} />
        </span>
      </div>
    </div>
  );
});
