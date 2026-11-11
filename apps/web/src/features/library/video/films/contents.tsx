"use client";

import { Dialog } from "radix-ui";
import { useRef, useState, type RefObject } from "react";

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
  /** The Index button: focus goes back to it when the sheet closes. */
  trigger: RefObject<HTMLButtonElement | null>;
  /** Where the sheet is drawn: the room while it is full screen (else the page's body). */
  container: HTMLElement | null;
}

/**
 * The contents of the room: the ten films in order, each one a button that goes straight to it. On
 * a wide screen the film under the pointer (or the focus) shows big on the right with its words;
 * on a narrow one each film is a large card (its picture across the card, the words below) under a
 * header that stays at the top. A plain sheet over the strip (no blur over the film behind it).
 * Esc, Close or a press on an empty part of the sheet shuts it, and the focus goes back to Index.
 */
export function Contents({
  open,
  onOpenChange,
  films,
  active,
  onPick,
  trigger,
  container,
}: ContentsProps) {
  const [shown, setShown] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
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
      <Dialog.Portal container={container}>
        <Dialog.Content
          ref={sheetRef}
          className={styles.sheet}
          data-theme="storm"
          data-lenis-prevent
          data-films-sheet=""
          data-blank=""
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            // Start on the film on screen, in view (the cards are tall on a phone).
            e.preventDefault();
            const row = sheetRef.current?.querySelector<HTMLElement>("[aria-current='true']");
            row?.focus({ preventScroll: true });
            // The cards (narrow layout) sit under the header that stays at the top; the short rows
            // of the wide layout only need to be in view.
            const cards = window.matchMedia("(max-width: 56.25em)").matches;
            row?.scrollIntoView({ block: cards ? "start" : "nearest" });
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            trigger.current?.focus({ preventScroll: true });
          }}
          onClick={(e) => {
            // A press on the sheet's empty space (not on a film, a word or a button) closes it. A
            // click, not a press: a finger that scrolls the list from a gap does not close it.
            const target = e.target as HTMLElement;
            if (target.hasAttribute("data-blank")) onOpenChange(false);
          }}
        >
          <div data-blank="">
            <div className={styles.sheetHead} data-blank="">
              <div>
                <Dialog.Title className={`display ${styles.sheetTitle}`}>Films</Dialog.Title>
                <p className={styles.sheetLead}>Ten official films, in order</p>
              </div>
              <Dialog.Close className={`${styles.pill} ${styles.close}`}>Close</Dialog.Close>
            </div>
            <ol className={styles.list} data-blank="">
              {films.map((f, i) => {
                const [a, b] = pairNames(f);
                return (
                  <li key={f.id} data-blank="">
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
                        srcSet={`${libUrl(f.thumb)} 480w, ${libUrl(f.video.poster)} 1280w`}
                        sizes="(max-width: 56.25em) calc(100vw - 2.5rem), 1px"
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
                      <span className={styles.rowDesc}>{f.desc}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
          <aside className={styles.preview} aria-hidden="true" data-blank="">
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
