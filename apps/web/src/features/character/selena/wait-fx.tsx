"use client";

import type { CSSProperties } from "react";

import styles from "./wait-fx.module.css";

interface Props {
  /** What is happening, for example "Opening About" or "Heading back". */
  label: string;
  /** How long the wait is, when it is known. */
  ms: number | null;
}

const STREAKS = [0, 1, 2, 3, 4, 5, 6] as const;
const CORNERS = ["tl", "tr", "bl", "br"] as const;

/**
 * Something to look at while the picture finds the frame it hands over on (a wait of up to a few
 * seconds). The edges of the screen darken, a light band travels down, thin streaks run across,
 * brackets close in on the corners, a chip says what is happening and a rail along the bottom
 * fills for exactly as long as the wait. When the length of the wait is not known the rail sweeps.
 *
 * It sits under the panel and the buttons and is only decoration: everything in it is hidden from
 * assistive technology (a status line says what is happening), and everything moves with
 * `transform` and `opacity`, so it costs the main thread nothing. Reduced motion: the vignette,
 * the chip and the rail only.
 */
export function WaitFx({ label, ms }: Props) {
  const style = ms === null ? undefined : ({ "--wait": `${Math.max(ms, 300)}ms` } as CSSProperties);
  return (
    <div
      className={styles.fx}
      data-mode={ms === null ? "hold" : "run"}
      style={style}
      aria-hidden="true"
    >
      <span className={styles.vignette} />
      <span className={styles.scan} />
      <span className={styles.streaks}>
        {STREAKS.map((n) => (
          <i key={n} style={{ "--n": n } as CSSProperties} />
        ))}
      </span>
      {CORNERS.map((c) => (
        <b key={c} className={styles.corner} data-c={c} />
      ))}
      <span className={styles.chip}>
        <span className={styles.spin} />
        <span>{label}</span>
        <span className={styles.dots}>
          <i>.</i>
          <i>.</i>
          <i>.</i>
        </span>
      </span>
      <span className={styles.rail}>
        <span className={styles.fill} />
      </span>
    </div>
  );
}
