"use client";

import { audio } from "@/lib/audio";

import styles from "./transcript-panel.module.css";
import { blocksForPage, groupLines, rangeLabel, transcriptSpan } from "./transcript";
import type { ComicItem } from "./types";

interface Props {
  comic: ComicItem;
  /** The page number in view. */
  current: number;
  open: boolean;
  onClose: () => void;
  onJump: (n: number) => void;
}

/** The nearest page before or after `current` that has text. */
function nearestTextPage(comic: ComicItem, current: number, dir: 1 | -1): number | null {
  const pages = comic.pages.filter((p) => (p.x?.length ?? 0) > 0).map((p) => p.n);
  if (dir === 1) return pages.find((n) => n > current) ?? null;
  return [...pages].reverse().find((n) => n < current) ?? null;
}

/**
 * The text of the page in view: a column beside the page on wide screens, a drawer from the
 * bottom on a phone. It follows the page as the strip scrolls.
 */
export function TranscriptPanel({ comic, current, open, onClose, onJump }: Props) {
  const found = blocksForPage(comic.transcript, current);
  const span = transcriptSpan(comic.transcript);
  const before = nearestTextPage(comic, current, -1);
  const after = nearestTextPage(comic, current, 1);
  const key = found.map((f) => f.index).join("-") || `none-${current}`;

  return (
    <aside
      className={styles.panel}
      data-open={open}
      aria-label="Transcript of the page in view"
      aria-hidden={!open}
      inert={!open}
    >
      <header className={styles.head}>
        <div>
          <p className={`${styles.kicker} hud-label`}>Text, page {current}</p>
          {found.length > 0 ? (
            <p className={styles.range}>
              {found.map((f) => rangeLabel(f.block.from, f.block.to)).join(" and ")}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.close}
          onClick={() => {
            audio.blip("click");
            onClose();
          }}
          aria-label="Close the text"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" fill="none" />
          </svg>
        </button>
      </header>

      <div className={styles.body} data-lenis-prevent key={key}>
        {found.length === 0 ? (
          <div className={styles.empty}>
            <p>No text for this page.</p>
            {span ? (
              <p className={styles.dim}>
                The transcript covers {rangeLabel(span.from, span.to).toLowerCase()}.
              </p>
            ) : (
              <p className={styles.dim}>This comic has no transcript.</p>
            )}
            <div className={styles.jumps}>
              {before !== null ? (
                <button
                  type="button"
                  onClick={() => {
                    onJump(before);
                  }}
                >
                  Text before, page {before}
                </button>
              ) : null}
              {after !== null ? (
                <button
                  type="button"
                  onClick={() => {
                    onJump(after);
                  }}
                >
                  Text after, page {after}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          found.map(({ index, block }) => (
            <section key={index} className={styles.block}>
              {groupLines(block.lines).map((g, i) => {
                if (g.kind === "scene") {
                  return (
                    <p key={i} className={styles.scene}>
                      <span className="hud-label">Scene</span> {g.lines.join(" ")}
                    </p>
                  );
                }
                if (g.kind === "note") {
                  return (
                    <p key={i} className={styles.note}>
                      <span className="hud-label">Explanation</span> {g.lines.join(" ")}
                    </p>
                  );
                }
                return (
                  <div key={i} className={g.who ? styles.say : styles.caption}>
                    {g.who ? <span className={`${styles.who} hud-label`}>{g.who}</span> : null}
                    {g.lines.map((line, j) => (
                      <p key={j}>{line}</p>
                    ))}
                  </div>
                );
              })}
            </section>
          ))
        )}
      </div>
    </aside>
  );
}
