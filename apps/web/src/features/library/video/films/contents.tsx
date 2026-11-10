"use client";

import { Dialog } from "radix-ui";
import { useState } from "react";

import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";

import { KIND_LABEL, clock, pairNames, two } from "./film-math";
import styles from "./films.module.css";
import type { FilmWork } from "./types";

interface ContentsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  films: readonly FilmWork[];
  /** The film on screen. */
  active: number;
  /** A film was chosen: the sheet closes and the strip goes to it. */
  onPick: (index: number) => void;
}

/**
 * The contents of the room: the ten films in order, each one a button that goes straight to it. On
 * a wide screen the film under the pointer (or the focus) shows big on the right with its words.
 * A plain sheet over the strip (no blur over the film behind it). Esc or Close shuts it.
 */
export function Contents({ open, onOpenChange, films, active, onPick }: ContentsProps) {
  const [shown, setShown] = useState<number | null>(null);
  const focus = shown ?? Math.max(0, active);
  const film = films[focus];

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setShown(null);
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Content
          className={styles.sheet}
          data-theme="storm"
          data-lenis-prevent
          data-films-sheet=""
          aria-describedby={undefined}
        >
          <div>
            <div className={styles.sheetHead}>
              <div>
                <Dialog.Title className={`display ${styles.sheetTitle}`}>Films</Dialog.Title>
                <p className={styles.sheetLead}>Ten official films, in order</p>
              </div>
              <Dialog.Close className={`${styles.pill} ${styles.close}`}>Close</Dialog.Close>
            </div>
            <ol className={styles.list}>
              {films.map((f, i) => {
                const [a, b] = pairNames(f);
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      className={styles.row}
                      aria-current={i === active ? "true" : undefined}
                      onPointerEnter={(e) => {
                        if (e.pointerType === "mouse") {
                          setShown(i);
                          audio.blip("hover");
                        }
                      }}
                      onFocus={() => {
                        setShown(i);
                      }}
                      onClick={() => {
                        audio.blip("click");
                        onPick(i);
                      }}
                    >
                      <span className={styles.rowNumber}>{two(i + 1)}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className={styles.rowThumb}
                        src={libUrl(f.thumb)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        width={480}
                        height={270}
                      />
                      <span>
                        <span className={`display ${styles.rowTitle}`}>{f.title}</span>
                      </span>
                      <span className={styles.rowMeta}>
                        {b ? `${a} and ${b}` : a}
                        <br />
                        {KIND_LABEL[f.kind]}, {clock(f.video.dur)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
          <aside className={styles.preview} aria-hidden="true">
            <div className={styles.previewArt}>
              {films.map((f, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={f.id}
                  src={libUrl(f.video.poster)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  data-shown={i === focus ? "true" : "false"}
                />
              ))}
            </div>
            {film ? <p className={styles.previewDesc}>{film.desc}</p> : null}
          </aside>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
