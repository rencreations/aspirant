"use client";

import type { CSSProperties, MutableRefObject, RefObject } from "react";

import styles from "./faces.module.css";

const WORD = "STORY";

/** How near each letter is to the visitor: the near ones follow the pointer further. */
export const STORY_DEPTH = [0.5, 0.78, 1, 0.78, 0.5] as const;

interface Props {
  /** The element the scroll moves (it drifts up and fades while the section is held). */
  wordRef: RefObject<HTMLDivElement | null>;
  /** One element per letter that the pointer parallax moves. */
  parRefs: MutableRefObject<Array<HTMLSpanElement | null>>;
  /** One element per letter that a press ripples. */
  ripRefs: MutableRefObject<Array<HTMLSpanElement | null>>;
}

/**
 * The big word in the middle of the pair. It is only decoration (the section's own heading says what
 * the section is), so it is hidden from reading software and never takes a click: the halves under
 * it stay the links.
 *
 * Every letter is a stack of small layers, so that each kind of movement has its own element and the
 * movements add up without fighting: the pointer parallax (set by the section's loop), the lean when
 * a half is pointed at, the ripple of a press, the rise out of its mask, and the slow float. Only
 * `transform` and `opacity` move. The magenta copy of each letter fades in over the violet one when
 * the Ender half is pointed at, and a pale copy lights each letter in turn now and then.
 */
export function StoryWord({ wordRef, parRefs, ripRefs }: Props) {
  return (
    <div ref={wordRef} className={styles.story} aria-hidden="true">
      <span className={styles.sw}>
        {[...WORD].map((c, i) => (
          <span key={i} className={styles.sl} style={{ "--i": i } as CSSProperties}>
            <span
              className={styles.sPar}
              ref={(el) => {
                parRefs.current[i] = el;
              }}
            >
              <span className={styles.sLean}>
                <span
                  className={styles.sRip}
                  ref={(el) => {
                    ripRefs.current[i] = el;
                  }}
                >
                  <span className={styles.sMask}>
                    <span className={styles.sIn}>
                      <span className={styles.sFloat}>
                        <span className={styles.g}>{c}</span>
                        <span className={styles.g2}>{c}</span>
                        <span className={styles.g3}>{c}</span>
                      </span>
                    </span>
                  </span>
                </span>
              </span>
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}
