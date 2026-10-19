"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { createPortal } from "react-dom";

import { prefersReducedMotion, useMounted } from "@/lib/hooks";

import styles from "./screen-cover.module.css";

export interface CoverApi {
  /**
   * Cover the whole screen with a slanted wipe, run `during` while nothing can be seen, then wipe
   * the screen clear again. Resolves when the screen is open.
   */
  run: (during: () => Promise<unknown> | void) => Promise<void>;
}

/** The leading edge leans by this much of the width. */
const SLANT = 14;
const IN_MS = 560;
const OUT_MS = 680;
const EASE = "cubic-bezier(0.83, 0, 0.17, 1)";

/** A region that grows from the left edge: its right edge is at `e` (percent of the width). */
const covering = (e: number) => `polygon(0% 0%, ${e}% 0%, ${e - SLANT}% 100%, 0% 100%)`;
/** A region that shrinks towards the right edge: its left edge is at `e`. */
const uncovering = (e: number) =>
  `polygon(${e}% 0%, 100% 0%, 100% 100%, ${Math.max(0, e - SLANT)}% 100%)`;

/**
 * A full-screen wipe. Two plates, gold then violet, sweep across and cover everything, the page
 * changes underneath, and they sweep on and uncover it. It sits above the nav so the whole screen
 * is covered. Reduced motion uses a short fade.
 */
export const ScreenCover = forwardRef<CoverApi>(function ScreenCover(_props, ref) {
  const root = useRef<HTMLDivElement>(null);
  const gold = useRef<HTMLSpanElement>(null);
  const plate = useRef<HTMLSpanElement>(null);
  const busy = useRef(false);
  const mounted = useMounted();

  useImperativeHandle(
    ref,
    (): CoverApi => ({
      run: async (during) => {
        const el = root.current;
        const a = gold.current;
        const b = plate.current;
        if (!el || !a || !b || busy.current) {
          await during();
          return;
        }
        busy.current = true;
        el.dataset.on = "true";
        try {
          if (prefersReducedMotion()) {
            await el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, fill: "both" })
              .finished;
            b.style.clipPath = "none";
            await during();
            await el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "both" })
              .finished;
            return;
          }
          const fwd = { duration: IN_MS, easing: EASE, fill: "both" } as const;
          // The gold edge leads, the plate follows 90 ms behind.
          a.animate([{ clipPath: covering(0) }, { clipPath: covering(100 + SLANT) }], fwd);
          const cover = b.animate(
            [{ clipPath: covering(0) }, { clipPath: covering(100 + SLANT) }],
            { ...fwd, delay: 90 },
          );
          await cover.finished;
          await during();
          // Leave the screen covered for a beat so the picture underneath has settled.
          await new Promise<void>((r) => window.setTimeout(r, 120));
          const out = { duration: OUT_MS, easing: EASE, fill: "both" } as const;
          b.animate([{ clipPath: uncovering(0) }, { clipPath: uncovering(100 + SLANT) }], out);
          const gone = a.animate(
            [{ clipPath: uncovering(0) }, { clipPath: uncovering(100 + SLANT) }],
            { ...out, delay: 80 },
          );
          await gone.finished;
        } finally {
          el.dataset.on = "false";
          for (const node of [el, a, b]) node.getAnimations().forEach((anim) => anim.cancel());
          b.style.clipPath = "";
          busy.current = false;
        }
      },
    }),
    [],
  );

  // In the body, so it is above the nav and the whole screen is covered.
  if (!mounted) return null;
  return createPortal(
    <div ref={root} className={styles.cover} data-on="false" aria-hidden="true">
      <span ref={gold} className={styles.gold} />
      <span ref={plate} className={styles.plate} />
    </div>,
    document.body,
  );
});
