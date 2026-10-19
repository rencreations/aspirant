"use client";

import type { CSSProperties } from "react";

import { asset } from "@/lib/asset";

import styles from "./menu-button.module.css";

const pad = (n: number) => String(n).padStart(2, "0");

interface Props {
  label: string;
  /** Public path of her picture on the button. */
  icon: string;
  /** Position in the list, from 1. */
  index: number;
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

/**
 * One of the three page buttons: an armour plate with her picture on it. On hover the picture
 * wobbles and a gold line grows from the right under the name. Pressing it answers at once:
 *
 *  1. She jumps at the camera (the picture grows, a ring leaves it),
 *  2. stomps the ground (it drops, squashes, the plate shakes and a shockwave spreads),
 *  3. and runs to the right for exactly as long as the wait for her matching frame. A red sheet
 *     follows her and covers the name, the number and the gold line, and says "Loading…".
 *
 * When the clip is still loading and the wait has no length, the sheet closes at once and she
 * hops in place until it is ready. Reduced motion: no jump, stomp or hop, only the sheet.
 */
export function MenuButton({
  label,
  icon,
  index,
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
  const src = asset(icon);
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
      <span className={styles.icon} aria-hidden="true">
        {/* Plain <img>: static export. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" draggable={false} decoding="async" />
      </span>
      <span className={styles.index} aria-hidden="true">
        {pad(index)}
      </span>
      <span className={styles.text}>{label}</span>
      <span className={styles.trim} aria-hidden="true" />
      <span className={styles.bars} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className={styles.sheen} aria-hidden="true" />
      {pressed ? (
        <span key={waitKey} className={styles.press} aria-hidden="true">
          <span className={styles.cover}>
            <span className={styles.sheet}>
              <span className={styles.loading}>
                Loading
                <span className={styles.dots}>
                  <i>.</i>
                  <i>.</i>
                  <i>.</i>
                </span>
              </span>
            </span>
          </span>
          <span className={styles.runner}>
            <span className={styles.pulse} />
            <span className={styles.leap}>
              <span className={styles.hop}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" draggable={false} decoding="async" />
              </span>
            </span>
            <span className={styles.dust} />
          </span>
        </span>
      ) : null}
    </button>
  );
}
