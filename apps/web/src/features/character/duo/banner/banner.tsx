"use client";

import type { Who } from "../duo-data";
import { useReveal } from "../use-reveal";
import styles from "./banner.module.css";

/**
 * A band of the page's mood, set huge, that drifts sideways forever between the opening and the
 * file: "Night shift" on Ruby's page, "First sunrise" on Angela's. One transform on the compositor,
 * paused when it is off screen.
 */
export function Banner({ who, text }: { who: Who; text: string }) {
  const ref = useReveal<HTMLDivElement>("0px");
  const run = Array.from({ length: 6 }, (_, i) => i);
  return (
    <div ref={ref} className={styles.band} data-who={who} role="presentation" aria-hidden="true">
      <div className={styles.track}>
        {[0, 1].map((half) => (
          <div key={half} className={styles.half}>
            {run.map((i) => (
              <span key={i} className={styles.item}>
                <span className={styles.word}>{text}</span>
                <span className={styles.mark}>{who === "ruby" ? "//" : "*"}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
