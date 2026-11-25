"use client";

import { libUrl } from "@/lib/library";

import { pad2 } from "./logic";
import styles from "./models.module.css";
import type { ModelEntry } from "./types";

interface PickerProps {
  entries: readonly ModelEntry[];
  entry: number;
  view: number;
  onPick: (entry: number, view: number) => void;
}

/**
 * The list of the room: the fifteen entries in the owner's order. The chosen one opens its views
 * under it (Selena: In Game, Entrance, Phone). Every row is a real button; the chosen entry and
 * view say so (`aria-current`).
 */
export function Picker({ entries, entry, view, onPick }: PickerProps) {
  return (
    <ol className={styles.list} data-models-list="">
      {entries.map((e, i) => {
        const on = i === entry;
        const thumb = e.views[0]?.poster.t;
        return (
          <li key={e.id} className={styles.row} data-on={on ? "" : undefined}>
            <button
              type="button"
              className={styles.entry}
              aria-current={on ? "true" : undefined}
              data-model-entry={e.id}
              onClick={() => {
                onPick(i, on ? view : 0);
              }}
            >
              <span className={styles.num} aria-hidden="true">
                {pad2(i + 1)}
              </span>
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.thumb}
                  src={libUrl(thumb)}
                  alt=""
                  width={48}
                  height={60}
                  crossOrigin="anonymous"
                  decoding="async"
                />
              ) : (
                <span className={styles.thumb} aria-hidden="true" />
              )}
              <span className={styles.entryName}>{e.title}</span>
            </button>
            {on && e.views.length > 1 ? (
              <ul className={styles.views} aria-label={`${e.title}: views`}>
                {e.views.map((v, k) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      className={styles.viewPill}
                      aria-current={k === view ? "true" : undefined}
                      data-model-view={v.id}
                      onClick={() => {
                        onPick(i, k);
                      }}
                    >
                      {v.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
