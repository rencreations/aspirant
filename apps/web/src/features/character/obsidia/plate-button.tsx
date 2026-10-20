"use client";

import type { CSSProperties } from "react";

import styles from "./plate-button.module.css";

const pad = (n: number) => String(n).padStart(2, "0");

export type Glyph = "about" | "skills" | "gallery" | "back";

interface Props {
  label: string;
  glyph: Glyph;
  /** Position in the list, from 1. Shown as 01, 02, 03. */
  index?: number;
  /** Text for the small badge instead of the number (the Back button shows its key). */
  badge?: string;
  /** The word on the plate while it waits. Default "Loading". */
  loadingWord?: string;
  /** Chosen and waiting for her matching frame (`queued`), or still loading the clip. */
  state: "idle" | "queued" | "loading";
  /** How long the wait is, when it is known. */
  waitMs: number | null;
  /** Changes when a new wait begins, so the animation starts again. */
  waitKey: number;
  disabled: boolean;
  onPointerEnter: () => void;
  onFocus: () => void;
  onClick: () => void;
}

/** A small line drawing for each button. The same stroke as the plate's edge. */
function GlyphIcon({ glyph }: { glyph: Glyph }) {
  return (
    <svg
      className={styles.glyph}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
    >
      {glyph === "about" ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="2.2" />
          <path d="M12 1.5v4M12 18.5v4" />
        </>
      ) : glyph === "skills" ? (
        <path d="M5 20 15 4M10 21 20 5M3 14 9 5" />
      ) : glyph === "gallery" ? (
        <>
          <path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5" />
          <path d="m8 16 3-4 2.5 3 2-2.5L19 16" />
        </>
      ) : (
        <path d="M20 12H5M11 5l-7 7 7 7" />
      )}
    </svg>
  );
}

/**
 * One of her page buttons: a dark plate with cut corners and a thin rose-gold edge, like the
 * armour of her weapon. On hover the edge turns gold, a light travels along it and the drawing
 * turns. Pressing it answers at once: the plate sinks, a ring leaves it and a rose bar fills the
 * plate for exactly as long as the wait for her matching frame, under the word "Loading". When
 * the clip is still loading and the wait has no length, a short bar runs back and forth until it
 * is ready. Reduced motion: no sinking and no ring, only the bar.
 */
export function PlateButton({
  label,
  glyph,
  index,
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
    ? ({ "--wait": `${known ? Math.max(waitMs, 120) : 900}ms` } as CSSProperties)
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
      <span className={styles.face} aria-hidden="true" />
      <span className={styles.sweep} aria-hidden="true" />
      <GlyphIcon glyph={glyph} />
      <span className={styles.name}>{label}</span>
      <span className={styles.index} aria-hidden="true">
        {badge ?? pad(index ?? 0)}
      </span>
      {pressed ? (
        <span key={waitKey} className={styles.press} aria-hidden="true">
          <span className={styles.fill} />
          <span className={styles.ring} />
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
