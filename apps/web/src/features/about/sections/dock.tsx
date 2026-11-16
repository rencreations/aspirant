"use client";

import type { ReactNode } from "react";

import type { DroneFace } from "../content";

import { useArrive } from "./arrive";
import styles from "./dock.module.css";

interface DockProps {
  /** The anchor's id: the drone comes to rest inside the ring. */
  anchor: string;
  face?: DroneFace;
  size?: "small" | "large";
  children?: ReactNode;
}

/**
 * The drone's place of rest: a ring of two thin brackets, a laurel reduced to geometry, in the
 * drone's own cyan. The brackets swing shut as the ring comes into view (a turn and a fade), and
 * the empty square in the middle is the anchor the drone flies to. What is said about the drone
 * stands under it.
 */
export function Dock({ anchor, face, size = "small", children }: DockProps) {
  const ref = useArrive<HTMLDivElement>("0px 0px -8% 0px");
  return (
    <div ref={ref} className={styles.dock} data-size={size} data-in="false">
      <div className={styles.ring}>
        <svg className={styles.svg} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
          <g className={styles.left}>
            <path className={styles.arc} d="M 44.8 160.6 A 82 82 0 0 1 44.8 39.4" />
            <path className={styles.fine} d="M 10.6 125.6 A 93 93 0 0 1 10.6 74.4" />
            <path className={styles.tick} d="M 18 100 H 7" />
          </g>
          <g className={styles.right}>
            <path className={styles.arc} d="M 155.2 39.4 A 82 82 0 0 1 155.2 160.6" />
            <path className={styles.fine} d="M 189.4 74.4 A 93 93 0 0 1 189.4 125.6" />
            <path className={styles.tick} d="M 182 100 H 193" />
          </g>
        </svg>
        <div
          className={styles.anchor}
          aria-hidden="true"
          data-drone-anchor={anchor}
          data-drone-face={face}
        />
      </div>
      {children ? <div className={styles.caption}>{children}</div> : null}
    </div>
  );
}
