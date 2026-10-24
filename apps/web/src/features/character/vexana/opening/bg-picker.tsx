"use client";

import { BACKGROUND_LIST, type BackgroundId } from "./backgrounds/registry";
import styles from "./opening.module.css";

interface Props {
  value: BackgroundId;
  onChange: (id: BackgroundId) => void;
}

/** The small control in the corner of the hero: one button per background. */
export function BackgroundPicker({ value, onChange }: Props) {
  const current = BACKGROUND_LIST.find((b) => b.id === value);
  return (
    <div className={styles.picker} role="radiogroup" aria-label="Hero background">
      <span className={styles.pickerLabel}>
        Background <b>{current?.label}</b>
      </span>
      <span className={styles.pickerRow}>
        {BACKGROUND_LIST.map((b, i) => (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={b.id === value}
            aria-label={b.label}
            className={styles.pickerBtn}
            data-on={b.id === value}
            onClick={() => {
              onChange(b.id as BackgroundId);
            }}
          >
            {String(i + 1).padStart(2, "0")}
          </button>
        ))}
      </span>
    </div>
  );
}
