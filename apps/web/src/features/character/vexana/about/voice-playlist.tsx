"use client";

import { useState } from "react";

import type { VoiceLine } from "@/content/types";
import { audio } from "@/lib/audio";

import styles from "./about.module.css";
import { VoiceRow } from "./voice-row";

/** Lines on one page of the playlist. */
const PAGE_SIZE = 12;

/**
 * Her voice lines, a page at a time. Every page sits in the same grid cell and only the current
 * one is visible, so the playlist is always as tall as its tallest page: turning a page never
 * changes the height of the section (the holds around it measure that height) and never moves the
 * scroll position. A line that plays when the page turns is stopped.
 */
export function VoicePlaylist({ lines }: { lines: readonly VoiceLine[] }) {
  const [page, setPage] = useState(0);
  const pages: VoiceLine[][] = [];
  for (let i = 0; i < lines.length; i += PAGE_SIZE) pages.push(lines.slice(i, i + PAGE_SIZE));
  const last = pages.length - 1;

  const go = (next: number) => {
    const to = Math.min(last, Math.max(0, next));
    if (to === page) return;
    audio.stopVoice();
    setPage(to);
  };

  return (
    <>
      <div className={styles.voicePages}>
        {pages.map((items, p) => (
          <ul
            key={p}
            className={styles.voiceList}
            data-current={p === page}
            aria-label={`Voice lines, page ${p + 1} of ${pages.length}`}
            aria-hidden={p === page ? undefined : true}
            inert={p === page ? undefined : true}
          >
            {items.map((line) => (
              <VoiceRow key={line.n} line={line} />
            ))}
          </ul>
        ))}
      </div>
      {pages.length > 1 ? (
        <nav className={styles.pager} aria-label="Voice line pages">
          <button
            type="button"
            className={styles.pagerStep}
            disabled={page === 0}
            onClick={() => {
              go(page - 1);
            }}
          >
            Previous
          </button>
          <ol className={styles.pagerNumbers}>
            {pages.map((_, p) => (
              <li key={p}>
                <button
                  type="button"
                  className={styles.pagerNumber}
                  aria-label={`Page ${p + 1}`}
                  aria-current={p === page ? "page" : undefined}
                  onClick={() => {
                    go(p);
                  }}
                >
                  {p + 1}
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className={styles.pagerStep}
            disabled={page === last}
            onClick={() => {
              go(page + 1);
            }}
          >
            Next
          </button>
          <p className={styles.pagerLabel} aria-live="polite">
            Page {page + 1} of {pages.length}
          </p>
        </nav>
      ) : null}
    </>
  );
}
