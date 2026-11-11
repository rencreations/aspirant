"use client";

import styles from "./design.module.css";

export interface RailEntry {
  id: string;
  /** The two digit number of the sheet. */
  no: string;
  title: string;
}

/**
 * The index of the sheets: a column of small ticks at the right edge that follows the scroll. The
 * sheet in view has a long dark tick and its number; a pointer or the keyboard on a tick shows the
 * name of the sheet; a press scrolls to it. Only `transform` and `opacity` change. It is a column of
 * real buttons, so it reads and works without a pointer.
 */
export function Rail({
  entries,
  current,
  onPick,
}: {
  entries: readonly RailEntry[];
  current: string | null;
  onPick: (id: string) => void;
}) {
  if (entries.length < 2) return null;
  return (
    <nav className={styles.rail} aria-label="Sheets" data-design-rail="">
      <ol className={styles.railList}>
        {entries.map((entry) => (
          <li key={entry.id} className={styles.railItem}>
            <button
              type="button"
              className={styles.railButton}
              aria-label={`${entry.no}, ${entry.title}`}
              aria-current={entry.id === current ? "true" : undefined}
              data-design-rail-id={entry.id}
              onClick={() => {
                onPick(entry.id);
              }}
            >
              <span className={styles.railNum} aria-hidden="true">
                {entry.no}
              </span>
              <span className={styles.railTick} aria-hidden="true" />
              <span className={styles.railName} aria-hidden="true">
                {entry.title}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
