"use client";

import gsap from "gsap";
import { forwardRef, useImperativeHandle, useRef } from "react";

import type { SceneHandle } from "../gate";
import styles from "./scenes.module.css";

/**
 * The fanart to her theme. A dark panel edged with film perforations is drawn across the screen
 * from the right like a film being pulled through a gate, pushing the board off to the left and
 * dimming it. The page jumps to the music film under the panel, and the panel is drawn on out of
 * the left side, so the film keeps moving the same way.
 */
export const FilmScene = forwardRef<SceneHandle>(function FilmScene(_, ref) {
  const panel = useRef<HTMLDivElement>(null);

  useImperativeHandle(
    ref,
    (): SceneHandle => ({
      build(ctx) {
        const k = ctx.level === "lite" ? 0.7 : 1;
        const tl = ctx.tl;
        gsap.set(panel.current, { x: ctx.vw + 90 });
        if (ctx.held) {
          tl.to(
            ctx.held,
            { x: -ctx.vw * 0.14, opacity: 0.55, duration: 0.75 * k, ease: "power3.inOut" },
            0,
          );
        }
        tl.to(panel.current, { x: 0, duration: 0.75 * k, ease: "power3.inOut" }, 0);
        ctx.hint(0.3 * k, "dark");
        ctx.swapAt(0.8 * k);
        tl.to(
          panel.current,
          { x: -ctx.vw - 90, duration: 0.8 * k, ease: "power3.inOut" },
          0.85 * k,
        );
        ctx.hint(1.0 * k, null);
      },
      reset() {
        gsap.set(panel.current, { x: 0 });
      },
    }),
    [],
  );

  return (
    <div className={styles.film}>
      <div ref={panel} className={styles.filmPanel}>
        <span className={styles.filmStrip} data-side="l" />
        <span className={styles.filmStrip} data-side="r" />
        <span className={styles.filmGlow} />
      </div>
    </div>
  );
});
