"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

import { prefersReducedMotion, useMounted } from "@/lib/hooks";

import type { CoverApi } from "../../stage/screen-cover";
import styles from "./board-cover.module.css";

/** The squares come in along a diagonal, each a little after the one before. */
const STEP_MS = 22;
const SQUARE_MS = 360;
/** How long the screen stays covered, so the picture underneath has settled. */
const HOLD_MS = 140;

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

function gridFor(width: number, height: number): { cols: number; rows: number } {
  const cols = width < 700 ? 8 : 14;
  return { cols, rows: Math.max(4, Math.ceil((cols * height) / Math.max(1, width))) };
}

/**
 * The wipe between her pictures: a chessboard. Squares of black and crimson velvet grow along a
 * diagonal, each with a gold edge that leads it, until the board covers the screen. The picture
 * changes underneath, and the squares shrink away in the same order. It sits above the nav so
 * the whole screen is covered. Reduced motion uses a short fade. Same API as `ScreenCover`.
 */
export const BoardCover = forwardRef<CoverApi>(function BoardCover(_props, ref) {
  const root = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const mounted = useMounted();
  const [grid, setGrid] = useState({ cols: 14, rows: 8 });

  useEffect(() => {
    const measure = () => {
      setGrid(gridFor(window.innerWidth, window.innerHeight));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, []);

  const total = (grid.cols + grid.rows - 2) * STEP_MS + SQUARE_MS + 120;

  useImperativeHandle(
    ref,
    (): CoverApi => ({
      run: async (during) => {
        const el = root.current;
        if (!el || busy.current) {
          await during();
          return;
        }
        busy.current = true;
        try {
          if (prefersReducedMotion()) {
            el.dataset.phase = "fade";
            await el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, fill: "both" })
              .finished;
            await during();
            await el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "both" })
              .finished;
            return;
          }
          el.dataset.phase = "in";
          await sleep(total);
          await during();
          await sleep(HOLD_MS);
          el.dataset.phase = "out";
          await sleep(total);
        } finally {
          el.dataset.phase = "off";
          el.getAnimations().forEach((anim) => anim.cancel());
          busy.current = false;
        }
      },
    }),
    [total],
  );

  const squares = useMemo(() => {
    const out: Array<{ c: number; r: number }> = [];
    for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) out.push({ c, r });
    return out;
  }, [grid]);

  // In the body, so it is above the nav and the whole screen is covered.
  if (!mounted) return null;
  return createPortal(
    <div
      ref={root}
      className={styles.cover}
      data-phase="off"
      aria-hidden="true"
      style={
        {
          "--cols": grid.cols,
          "--rows": grid.rows,
          "--step": `${STEP_MS}ms`,
          "--dur": `${SQUARE_MS}ms`,
        } as CSSProperties
      }
    >
      {squares.map(({ c, r }) => (
        <i
          key={`${c}-${r}`}
          className={styles.square}
          data-tone={(c + r) % 2}
          style={{ "--d": c + r } as CSSProperties}
        >
          <b />
          <u />
        </i>
      ))}
    </div>,
    document.body,
  );
});
