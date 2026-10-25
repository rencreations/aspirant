"use client";

import type { CSSProperties } from "react";

import { asset } from "@/lib/asset";

import styles from "./room.module.css";
import type { NextCharacter } from "./room";

const pad = (n: number) => String(n).padStart(2, "0");

interface Props {
  next: NextCharacter;
  /** The strength meter is full: the bar is up. */
  open: boolean;
  /** Reduced motion: the meter does not move the page, the button does. */
  reduced: boolean;
  onGo: () => void;
}

/**
 * The bar at the foot of the room, a fifth of the screen high and as wide as it. It slides up when
 * the strength meter is full and says that scrolling on goes to the next character's page, with
 * her picture, her name and a meter that fills as the visitor keeps scrolling (`--ahead`, set by
 * `useRoomScroll`). The Continue button and the N key do the same without scrolling.
 */
export function NextBar({ next, open, reduced, onGo }: Props) {
  const preview = next.image.replace(/splash\.webp$/, "splash-sm.webp");
  return (
    <aside
      className={styles.nextBar}
      data-open={open}
      aria-label={`Next character: ${next.name}`}
      inert={!open}
      style={{ "--accent": next.accent } as CSSProperties}
    >
      <span className={styles.nextEdge} aria-hidden="true" />
      <div className={styles.nextPreview} aria-hidden="true">
        {/* Plain <img>: static export. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset(preview)} alt="" draggable={false} decoding="async" />
      </div>
      <div className={styles.nextText}>
        <p className={styles.nextEyebrow}>Next in queue, unit {pad(next.order)} of 10</p>
        <p className={styles.nextName}>{next.name}</p>
        <p className={styles.nextSub}>{next.aspirantName}</p>
      </div>
      <div className={styles.nextAhead}>
        <p className={styles.nextHint}>
          {reduced ? "Press N or use Continue" : `Keep scrolling to meet ${next.name}`}
        </p>
        <span className={styles.nextMeter} aria-hidden="true">
          <span className={styles.nextFill} />
        </span>
      </div>
      <button
        type="button"
        className={styles.nextGo}
        aria-label={`Continue to ${next.name}`}
        aria-keyshortcuts="N"
        onClick={onGo}
      >
        <span>Continue</span>
        <kbd aria-hidden="true">N</kbd>
      </button>
    </aside>
  );
}
