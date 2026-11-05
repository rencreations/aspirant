"use client";

import { useRef, useState } from "react";

import { audio } from "@/lib/audio";

import { inkOn } from "./model";
import styles from "./palette.module.css";
import type { Swatch } from "./types";

/** The dominant colours as one slim strip, each as wide as its share of the picture. */
export function PaletteStrip({
  pal,
  label = "Dominant colours",
}: {
  pal: readonly Swatch[];
  label?: string;
}) {
  if (pal.length === 0) return null;
  return (
    <ul className={styles.strip} aria-label={label}>
      {pal.map(([hex, percent]) => (
        <li
          key={hex}
          style={{ flexGrow: percent, backgroundColor: hex }}
          title={`${hex}, ${percent}%`}
        >
          <span className="sr-only">
            {hex}, {percent} percent
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The same colours as swatches with their codes. Pressing one copies the code. */
export function PaletteCard({ pal }: { pal: readonly Swatch[] }) {
  const [copied, setCopied] = useState("");
  const timer = useRef<number | undefined>(undefined);

  const copy = (hex: string) => {
    audio.blip("click");
    const done = () => {
      setCopied(hex);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setCopied("");
      }, 1600);
    };
    try {
      void navigator.clipboard.writeText(hex).then(done, done);
    } catch {
      done();
    }
  };

  return (
    <div className={styles.card}>
      <ul className={styles.swatches} aria-label="Dominant colours, press one to copy its code">
        {pal.map(([hex, percent]) => (
          <li key={hex} style={{ flexGrow: Math.max(percent, 12) }}>
            <button
              type="button"
              className={styles.swatch}
              style={{ backgroundColor: hex, color: inkOn(hex) }}
              onClick={() => {
                copy(hex);
              }}
              aria-label={`${hex}, ${percent} percent. Copy the code.`}
            >
              <span className={styles.hex}>{hex.toUpperCase()}</span>
              <span className={styles.share}>{percent}%</span>
            </button>
          </li>
        ))}
      </ul>
      <p className={`${styles.note} hud-label`} role="status" aria-live="polite">
        {copied ? `Copied ${copied.toUpperCase()}` : "Press a colour to copy its code"}
      </p>
    </div>
  );
}
