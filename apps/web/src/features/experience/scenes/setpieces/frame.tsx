"use client";

import type { CSSProperties, ReactNode } from "react";

import { HudPanel } from "@/components/ui/hud-panel";

import { SET_PIECE_ANCHORS } from "./anchors";
import styles from "./setpieces.module.css";

export interface SetPieceFrameProps {
  /** Anchor id: the caption and the accessible description come from the anchor. */
  id: string;
  /** Short HUD code on the right of the header, for example "LIT 0042 / 1000". */
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
 * The frame every inline set piece sits in: a glass HUD panel with the anchor's caption as its
 * label, a stage, an optional footer, and the anchor's description for assistive tech.
 */
export function SetPieceFrame({ id, code, accent, aspect, children, footer }: SetPieceFrameProps) {
  const anchor = SET_PIECE_ANCHORS.find((a) => a.id === id);
  const descId = `setpiece-${id}-desc`;
  const style = {
    ...(accent ? { "--sp-accent": accent } : {}),
    ...(aspect ? { "--sp-aspect": aspect } : {}),
  } as CSSProperties;
  return (
    <figure className={styles.piece} style={style} data-set-piece={id} aria-describedby={descId}>
      <HudPanel label={anchor?.caption ?? id} code={code} accent={accent} tone="glass" scan>
        <div className={styles.stage}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </HudPanel>
      <figcaption id={descId} className="sr-only">
        {anchor?.label}
      </figcaption>
    </figure>
  );
}
