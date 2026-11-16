"use client";

import type { CSSProperties } from "react";

import { DRONE_CAPTION, STATEMENT_LINES, STATEMENT_SOURCE } from "../content";

import { useArrive } from "./arrive";
import { Dock } from "./dock";
import kit from "./kit.module.css";
import styles from "./statement.module.css";

/**
 * The statement: six centred lines that say what the series is, on the same paper as the first
 * screen. The drone comes to the middle of the screen in front of them, turns with the scroll and
 * then goes to rest in the ring at the foot of the section.
 *
 * Two anchors are placed here. `center` is a square held in the middle of the screen while the
 * lines pass (sticky inside a rail that spans the lines and stops above the ring). `dock` is the
 * square inside the ring.
 */
export function Statement() {
  const ref = useArrive<HTMLDivElement>("0px 0px -18% 0px");

  return (
    <section
      className={styles.statement}
      data-about-section="statement"
      aria-labelledby="about-statement"
    >
      <div className={styles.stage}>
        <div className={styles.rail} aria-hidden="true">
          <div className={styles.center} data-drone-anchor="center" />
        </div>

        <div ref={ref} className={styles.body} data-in="false">
          <p className={styles.source}>
            <span className={styles.drop} aria-hidden="true" />
            <span className={kit.mask}>
              <span className={kit.line}>
                <q>{STATEMENT_SOURCE.quote}</q>
              </span>
            </span>
            <span className={kit.mask}>
              <span
                className={`${kit.line} ${styles.sourceDate}`}
                style={{ "--i": 1 } as CSSProperties}
              >
                Official announcement, {STATEMENT_SOURCE.date}
              </span>
            </span>
          </p>

          <h2 id="about-statement" className={`display ${styles.lines}`}>
            {STATEMENT_LINES.map((line, i) => (
              <span key={i} className={kit.mask}>
                <span className={kit.line} style={{ "--i": i + 2 } as CSSProperties}>
                  {line.map((word, k) => (
                    <span key={k}>
                      {k > 0 ? " " : null}
                      {word.serif ? (
                        <em className={styles.serif} data-tone={word.serif}>
                          {word.text}
                        </em>
                      ) : (
                        word.text
                      )}
                    </span>
                  ))}{" "}
                </span>
              </span>
            ))}
          </h2>
        </div>
      </div>

      <div className={styles.foot}>
        <Dock anchor="dock">
          <b>{DRONE_CAPTION.label}</b>
          {DRONE_CAPTION.line}
        </Dock>
      </div>
    </section>
  );
}
