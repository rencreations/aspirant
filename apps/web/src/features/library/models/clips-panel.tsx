"use client";

import { useState } from "react";

import type { ClipView } from "./behaviours";
import { clipRows } from "./logic";
import styles from "./models.module.css";

interface ClipsPanelProps {
  view: ClipView;
  onPick: (id: string) => void;
  onForm: (form: string) => void;
}

/**
 * The animations of the view on show. A view with forms (Selena In Game) has the Normal and Abyssal
 * switch on top: while a change runs it is disabled and so is the list. Clips that belong together
 * (In, Loop and Out) are one row that opens like a dropdown.
 */
export function ClipsPanel({ view, onPick, onForm }: ClipsPanelProps) {
  const rows = clipRows(view.clips);
  const [open, setOpen] = useState<string | null>(null);
  const groupOf = view.clips.find((c) => c.id === view.clip)?.group ?? null;
  return (
    <div
      className={styles.clips}
      data-models-clips=""
      data-changing={view.changing ? "" : undefined}
    >
      {view.forms && view.forms.length > 1 ? (
        <div className={styles.forms} role="group" aria-label="Form">
          {view.forms.map((f) => (
            <button
              key={f.id}
              type="button"
              className={styles.formBtn}
              aria-pressed={view.form === f.id}
              disabled={view.changing}
              data-model-form={f.id}
              onClick={() => {
                onForm(f.id);
              }}
            >
              {f.label}
            </button>
          ))}
          <span className={styles.formNote} role="status">
            {view.changing ? "Changing form" : ""}
          </span>
        </div>
      ) : null}
      <ul className={styles.clipList} aria-label="Animations">
        {rows.map((row) => {
          if (row.kind === "clip") {
            const c = row.clip;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={styles.clip}
                  aria-pressed={view.clip === c.id}
                  disabled={view.changing}
                  data-model-clip={c.id}
                  onClick={() => {
                    setOpen(null);
                    onPick(c.id);
                  }}
                >
                  {c.label}
                </button>
              </li>
            );
          }
          const expanded = open === row.id || (open === null && groupOf === row.id);
          const listId = `clips-${row.id}`;
          return (
            <li key={row.id} className={styles.group} data-open={expanded ? "" : undefined}>
              <button
                type="button"
                className={styles.clip}
                aria-expanded={expanded}
                aria-controls={listId}
                data-on={groupOf === row.id ? "" : undefined}
                disabled={view.changing}
                data-model-group={row.id}
                onClick={() => {
                  setOpen(expanded ? "" : row.id);
                }}
              >
                {row.label}
                <svg
                  className={styles.chev}
                  viewBox="0 0 12 12"
                  width="12"
                  height="12"
                  aria-hidden="true"
                >
                  <path
                    d="M3 4.5 6 7.5 9 4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                </svg>
              </button>
              <ul id={listId} className={styles.sub} hidden={!expanded}>
                {row.clips.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={styles.subClip}
                      aria-pressed={view.clip === c.id}
                      disabled={view.changing}
                      data-model-clip={c.id}
                      onClick={() => {
                        onPick(c.id);
                      }}
                    >
                      {c.label}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
