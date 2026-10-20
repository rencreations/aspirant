"use client";

import type { CSSProperties } from "react";

import styles from "./blade-button.module.css";

interface Props {
  label: string;
  /** A small hint on the right, for example the key that does the same (ESC). */
  badge?: string;
  /** The word on the blade while it waits. Default "Loading". */
  loadingWord?: string;
  state: "idle" | "queued" | "loading";
  waitMs: number | null;
  waitKey: number;
  disabled: boolean;
  onPointerEnter: () => void;
  onFocus: () => void;
  onClick: () => void;
}

/**
 * The Back button: a dark blade with a gold edge, cut at two corners like the page buttons. On
 * press a gold bar fills it for exactly as long as the wait (or a short bar runs to and fro while
 * the length is not known), under the word that says what is happening.
 */
export function BladeButton({
  label,
  badge,
  loadingWord = "Loading",
  state,
  waitMs,
  waitKey,
  disabled,
  onPointerEnter,
  onFocus,
  onClick,
}: Props) {
  const pressed = state !== "idle";
  const known = pressed && waitMs !== null;
  const style = pressed
    ? ({ "--wait": `${known ? Math.max(waitMs, 200) : 1200}ms` } as CSSProperties)
    : undefined;
  return (
    <button
      type="button"
      className={styles.button}
      data-state={state}
      data-mode={pressed ? (known ? "run" : "hold") : undefined}
      aria-pressed={pressed}
      disabled={disabled}
      style={style}
      onPointerEnter={onPointerEnter}
      onFocus={onFocus}
      onClick={onClick}
    >
      <span className={styles.plate} aria-hidden="true" />
      <svg className={styles.arrow} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M20 12H5M11 5l-7 7 7 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
      </svg>
      <span className={styles.name}>{label}</span>
      {badge ? (
        <span className={styles.badge} aria-hidden="true">
          {badge}
        </span>
      ) : null}
      {pressed ? (
        <span key={waitKey} className={styles.press} aria-hidden="true">
          <span className={styles.fill} />
          <span className={styles.status}>
            {loadingWord}
            <span className={styles.dots}>
              <i>.</i>
              <i>.</i>
              <i>.</i>
            </span>
          </span>
        </span>
      ) : null}
    </button>
  );
}
