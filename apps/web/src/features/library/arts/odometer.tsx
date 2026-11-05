"use client";

import { useEffect, useState } from "react";

import styles from "./odometer.module.css";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/**
 * A number whose digits roll to the new value, like the counter of a meter. It starts at zero and
 * rolls up when it first shows. Each digit is a column of ten and moves by `transform` only. The
 * real number is in the accessible name.
 */
export function Odometer({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    // One frame later, so the first value rolls up from zero instead of appearing.
    const id = requestAnimationFrame(() => {
      setShown(Math.max(0, Math.round(value)));
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, [value]);

  const digits = String(shown).split("").map(Number);
  return (
    <span className={`${styles.odo} ${className ?? ""}`} role="img" aria-label={String(value)}>
      {digits.map((d, i) => {
        // Keyed from the right, so a column keeps its place when the number gets a digit longer.
        const place = digits.length - 1 - i;
        return (
          <span key={place} className={styles.col} aria-hidden="true">
            <span className={styles.strip} style={{ transform: `translate3d(0, ${-d}em, 0)` }}>
              {DIGITS.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
