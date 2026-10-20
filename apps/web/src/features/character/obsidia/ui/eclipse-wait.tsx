"use client";

import type { CSSProperties } from "react";

import styles from "./eclipse-wait.module.css";

interface Props {
  /** What is happening, for example "Opening About" or "Heading back". */
  label: string;
  /** How long the wait is, when it is known. */
  ms: number | null;
  /** The rail starts again when this changes (the way back has two parts, on one screen). */
  railKey?: number;
  /** The picture is running faster than normal to get there sooner. */
  fast: boolean;
}

/**
 * What is on screen while she waits for the frame she hands over on (a few seconds). The edges of
 * the screen darken to crimson, a plaque with a clock says what is happening, and a rail of board
 * squares along the bottom fills for exactly as long as the wait. The clock's hand goes once round
 * in the same time. While the picture runs faster to get there sooner, chevrons say so. When the
 * length of the wait is not known the hand circles and the rail sweeps.
 *
 * It sits under the panel and the buttons and is only decoration: everything in it is hidden
 * from assistive technology (a status line says what is happening), and everything moves with
 * `transform` and `opacity`. Reduced motion: the vignette, the plaque and the rail only.
 */
export function EclipseWait({ label, ms, railKey = 0, fast }: Props) {
  const style = ms === null ? undefined : ({ "--wait": `${Math.max(ms, 300)}ms` } as CSSProperties);
  return (
    <div
      className={styles.fx}
      data-mode={ms === null ? "hold" : "run"}
      data-fast={fast}
      style={style}
      aria-hidden="true"
    >
      <span className={styles.vignette} />
      <span className={styles.plaque}>
        <span className={styles.clock}>
          <span key={railKey} className={styles.hand} />
          <span className={styles.core} />
        </span>
        <span className={styles.words}>
          <span className={styles.label}>{label}</span>
          <span className={styles.sub}>
            <span className={styles.chevrons}>
              <i />
              <i />
              <i />
            </span>
            <span className={styles.subText}>{fast ? "Time moves on" : "One moment"}</span>
          </span>
        </span>
      </span>
      <span className={styles.rail}>
        <span className={styles.squares} />
        <span key={railKey} className={styles.fill} />
      </span>
    </div>
  );
}
