"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

import {
  coverScale,
  heartClip,
  openScale,
  progressAt,
  scaleAt,
} from "../../vexana/seams/heart-geometry";
import styles from "./heart-hole.module.css";

export interface HeartHoleApi {
  /** 0 is the hole wide open (nothing of the colour is seen), 1 is shut (the colour is all there is). */
  set: (shut: number) => void;
  /** The progress at which the colour reaches the top-right corner (where the nav text is). */
  cornerAt: () => number;
  /** The layer, for a caller that fades it. */
  el: () => HTMLDivElement | null;
}

/**
 * A layer of colour with a heart cut out of it, closing in on whatever is under it: the hole shrinks
 * from wider than the screen to nothing, so the colour comes in from all the sides at once. It
 * is the only thing that moves, so it is one clip-path written when the progress changes (a repaint
 * of one flat colour; nothing else on the page moves for it).
 */
export const HeartHole = forwardRef<HeartHoleApi>(function HeartHole(_props, ref) {
  const box = useRef<HTMLDivElement>(null);
  const memo = useRef({ w: 0, h: 0, open: 1 });
  const last = useRef("");

  const measure = () => {
    const el = box.current;
    const m = memo.current;
    if (!el) return m;
    const w = el.offsetWidth || window.innerWidth;
    const h = el.offsetHeight || window.innerHeight;
    if (w !== m.w || h !== m.h) {
      m.w = w;
      m.h = h;
      m.open = openScale(w, h);
    }
    return m;
  };

  useImperativeHandle(
    ref,
    (): HeartHoleApi => ({
      set(shut) {
        const el = box.current;
        if (!el) return;
        const p = Math.min(1, Math.max(0, shut));
        let vis = "visible";
        let clip = "none";
        if (p <= 0.0005) vis = "hidden";
        else if (p < 0.9995) {
          const m = measure();
          clip = heartClip(m.w, m.h, scaleAt(p, m.open));
        }
        if (vis !== el.style.visibility) el.style.visibility = vis;
        if (clip !== last.current) {
          last.current = clip;
          el.style.clipPath = clip;
        }
      },
      cornerAt() {
        const m = measure();
        return progressAt(coverScale(m.w / 2 - 70, -m.h / 2 + 28), m.open);
      },
      el: () => box.current,
    }),
    [],
  );

  return <div ref={box} className={styles.hole} aria-hidden="true" />;
});
