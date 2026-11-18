import { HAND } from "../../content";
import type { SectionMarkup } from "../../kernel/types";

import styles from "./hand.module.css";

/** The hint's open palm, a line drawing (the reference's own icon is a palm with the fingers up). */
function HintIcon() {
  return (
    <svg
      className={styles.hintIcon}
      data-hand-hint-icon=""
      viewBox="0 0 26 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 18V8.5a1.6 1.6 0 0 1 3.2 0V15" />
      <path d="M10.2 15V5.5a1.6 1.6 0 0 1 3.2 0V15" />
      <path d="M13.4 15V6.5a1.6 1.6 0 0 1 3.2 0V16" />
      <path d="M16.6 16v-5.5a1.6 1.6 0 0 1 3.2 0V19c0 5-3 9-8 9-3.2 0-5-1.6-6.4-4L3 19.5a1.6 1.6 0 0 1 2.6-1.8L7 19" />
    </svg>
  );
}

/**
 * What the server draws for the section: the owner's words, from `content.ts`. The title is split
 * into letters for the reveal (a screen reader gets the whole words from the hidden copy).
 */
export function view(): SectionMarkup {
  const letters = Array.from(HAND.title);
  return {
    text: (
      <div className={styles.stage}>
        <div className={styles.head} data-hand-head="">
          <h2 className={styles.title} data-hand-title="">
            <span className={styles.sr}>{HAND.title}</span>
            <span aria-hidden="true">
              {letters.map((c, i) => (
                <span key={i} className={styles.ch} data-hand-ch="">
                  {c}
                </span>
              ))}
            </span>
          </h2>
          <p className={styles.desc} data-hand-desc="">
            {HAND.body}
          </p>
        </div>
        <div className={styles.hint} data-hand-hint="">
          <HintIcon />
          <i className={styles.hintLine} data-hand-hint-line="" aria-hidden="true" />
          <span className={styles.hintText}>{HAND.hint}</span>
        </div>
      </div>
    ),
  };
}
