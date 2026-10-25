"use client";

import gsap from "gsap";
import { forwardRef, useImperativeHandle, useRef } from "react";

import type { SceneHandle } from "../gate";
import styles from "./scenes.module.css";

/**
 * The gallery to the fanart. A picture frame appears in the middle of the gallery and the visitor
 * falls into it: the frame grows until its pale inside is the whole screen (the colour of the fanart
 * board), the gallery behind it leaning in and dimming. The page jumps to the board under the frame,
 * the frame's border and pins pass beyond the edges of the screen, and the board is left.
 */
export const FrameScene = forwardRef<SceneHandle>(function FrameScene(_, ref) {
  const frame = useRef<HTMLDivElement>(null);

  useImperativeHandle(
    ref,
    (): SceneHandle => ({
      build(ctx) {
        const k = ctx.level === "lite" ? 0.7 : 1;
        const tl = ctx.tl;
        gsap.set(frame.current, { xPercent: -50, yPercent: -50, scale: 0.5, opacity: 0 });
        if (ctx.held) {
          tl.set(ctx.held, { transformOrigin: ctx.pivot() }, 0);
          tl.to(ctx.held, { scale: 1.14, opacity: 0.4, duration: 1.0 * k, ease: "power2.in" }, 0);
        }
        tl.to(frame.current, { opacity: 1, scale: 0.7, duration: 0.3 * k, ease: "power2.out" }, 0);
        tl.to(frame.current, { scale: 4.4, duration: 0.85 * k, ease: "power3.in" }, 0.3 * k);
        ctx.hint(0.9 * k, "light");
        ctx.swapAt(1.04 * k);
        tl.to(frame.current, { opacity: 0, duration: 0.22 * k, ease: "power1.in" }, 1.1 * k);
      },
      reset() {
        gsap.set(frame.current, { opacity: 0 });
      },
    }),
    [],
  );

  return (
    <div ref={frame} className={styles.zFrame}>
      <span className={styles.zPin} data-at="tl" />
      <span className={styles.zPin} data-at="tr" />
      <span className={styles.zPin} data-at="bl" />
      <span className={styles.zPin} data-at="br" />
    </div>
  );
});
