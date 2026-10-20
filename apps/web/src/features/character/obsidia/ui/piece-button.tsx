"use client";

import type { CSSProperties } from "react";

import { asset } from "@/lib/asset";

import styles from "./piece-button.module.css";

/** The chess piece on each page's button: a pawn, a knight and a queen. */
export type Piece = "pawn" | "knight" | "queen";

const pieceImage = (piece: Piece) => `/img/obsidia/ui/${piece}.webp`;

interface Props {
  label: string;
  piece: Piece;
  /** The rank of the button in the row: 1, 2, 3. Shown as a Roman numeral. */
  rank: number;
  /** The word that shows while it waits. Default "Opening". */
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

const ROMAN = ["", "I", "II", "III", "IV"] as const;

/**
 * One of her page buttons: a plate on a board square with a chess piece standing on it. On hover
 * the piece rises and the black eclipse behind it flares its gold ring. Pressing it moves the
 * piece, and the ring draws itself round the piece for exactly as long as the wait for her
 * matching frame (an eclipse closing). When the clip is still loading and the wait has no length,
 * a short arc of the ring circles the piece until it is ready. Reduced motion: no rising and no
 * moving, only the ring.
 */
export function PieceButton({
  label,
  piece,
  rank,
  loadingWord = "Opening",
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
    ? ({ "--wait": `${known ? Math.max(waitMs, 200) : 1400}ms` } as CSSProperties)
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
      <span className={styles.stand} aria-hidden="true">
        <span className={styles.eclipse} />
        {/* The ring is made of two halves that turn, so it draws itself with transforms only. */}
        <span key={pressed ? waitKey : "idle"} className={styles.ring}>
          <span className={styles.half} data-half="a">
            <i />
          </span>
          <span className={styles.half} data-half="b">
            <i />
          </span>
          <span className={styles.orbit}>
            <i />
          </span>
        </span>
        {/* Plain <img>: static export. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.piece}
          src={asset(pieceImage(piece))}
          alt=""
          width={96}
          height={96}
          draggable={false}
          decoding="async"
        />
      </span>
      <span className={styles.text}>
        <span className={styles.rank} aria-hidden="true">
          {ROMAN[rank] ?? rank}
        </span>
        <span className={styles.name}>{label}</span>
        <span className={styles.status} aria-hidden="true">
          {loadingWord}
          <span className={styles.dots}>
            <i>.</i>
            <i>.</i>
            <i>.</i>
          </span>
        </span>
      </span>
      <span className={styles.rule} aria-hidden="true" />
    </button>
  );
}
