"use client";

import type { CSSProperties, ReactNode } from "react";

import styles from "./setpieces.module.css";

export interface SetPieceFrameProps {
  /** Anchor id (for styling hooks and tests). */
  id: string;
  /** Short HUD readout over the stage, for example "LIT 0042 / 1000". */
  code?: string;
  /** Accent colour (any CSS colour). */
  accent?: string;
  /** Aspect ratio of the stage on wide screens. Default "16 / 9". */
  aspect?: string;
  /** The interactive stage (usually one focusable canvas). */
  children: ReactNode;
  /** Controls and readouts under the stage (buttons, meters, a live region). */
  footer?: ReactNode;
}

/**
 * The inside of a set piece: a stage with a HUD readout and a footer. The reader's
 * `SetPieceHost` supplies the outer HUD panel, the caption, the skip links and the label.
 */
export function SetPieceFrame({ id, code, accent, aspect, children, footer }: SetPieceFrameProps) {
  const style = {
    ...(accent ? { "--sp-accent": accent } : {}),
    ...(aspect ? { "--sp-aspect": aspect } : {}),
  } as CSSProperties;
  return (
    <div className={styles.piece} style={style} data-set-piece={id}>
      <div className={styles.stage}>
        {children}
        {code ? (
          <span className={styles.code} aria-hidden="true">
            {code}
          </span>
        ) : null}
      </div>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  );
}
