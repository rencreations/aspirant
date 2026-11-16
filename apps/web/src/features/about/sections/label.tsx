"use client";

import type { CSSProperties } from "react";

import { LABEL } from "../content";

import { useArrive } from "./arrive";
import kit from "./kit.module.css";
import styles from "./label.module.css";

const i = (n: number) => ({ "--i": n }) as CSSProperties;

/**
 * TheMLabel, in the official words: what it is, that The Aspirants is the first series in it, the
 * day it opened, its three parts and the four perks. A calm block of type: the name in the serif
 * (it keeps its capitals, which the display face would lose), two quoted lines, three hairline
 * rows. The drone waits in the empty space beside the name, then under the two quoted lines. On a
 * narrow screen, where the section is several screens long, it has a third place in the empty
 * space after the section, so it never waits over the words.
 */
export function Label() {
  const ref = useArrive<HTMLElement>();

  return (
    <section
      ref={ref}
      className={`${kit.section} ${styles.label}`}
      data-about-section="label"
      aria-labelledby="about-label"
    >
      <div className={kit.inner}>
        <header className={styles.head} data-in="false">
          <div>
            <p className={kit.eyebrow}>
              <b>05</b>
              <span>In the game</span>
              <span className={kit.eyebrowRule} aria-hidden="true" />
              <span>Since {LABEL.launched}</span>
            </p>
            <h2 id="about-label" className={styles.name} aria-label={LABEL.name}>
              <span className={kit.mask} aria-hidden="true">
                <span className={kit.line}>
                  The<span className={styles.m}>M</span>Label
                </span>
              </span>
            </h2>
          </div>
          <div
            className={`${kit.anchor} ${styles.anchor}`}
            aria-hidden="true"
            data-drone-anchor="label"
            data-drone-face="happy"
            data-drone-turn={-20}
          />
        </header>

        <div className={styles.body}>
          <div className={styles.say} data-in="false">
            <span className={kit.rule} aria-hidden="true" />
            <blockquote className={`serif ${styles.quote} ${kit.rise}`}>
              <p>
                <q>{LABEL.definition}</q>
              </p>
              <p style={i(1)}>
                <q>{LABEL.first}</q>
              </p>
            </blockquote>
            <div className={styles.sayFoot}>
              <p className={`${styles.cite} ${kit.rise}`} style={i(3)}>
                The official announcement, September 2026
              </p>
              <div
                className={`${kit.anchor} ${styles.rest}`}
                aria-hidden="true"
                data-drone-anchor="label-quote"
                data-drone-face="squint"
                data-drone-turn={24}
              />
            </div>
          </div>

          <ol className={styles.parts} data-in="false">
            {LABEL.parts.map((part, k) => (
              <li key={part.id} className={styles.part} style={i(k)}>
                <span className={`${styles.index} ${kit.rise}`} style={i(k)} aria-hidden="true">
                  {String(k + 1).padStart(2, "0")}
                </span>
                <h3 className={styles.partTitle}>
                  <span className={kit.mask}>
                    <span className={`display ${kit.line}`} style={i(k)}>
                      {part.title}
                    </span>
                  </span>
                </h3>
                {part.id === "perks" ? (
                  <ul className={styles.perks}>
                    {LABEL.perks.map((perk, n) => (
                      <li key={perk} className={`${styles.perk} ${kit.rise}`} style={i(k + n + 1)}>
                        {perk}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={`${styles.partLine} ${kit.rise}`} style={i(k + 1)}>
                    {part.line}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>

        <div className={styles.out} aria-hidden="true">
          <div className={kit.anchor} data-drone-anchor="label-out" />
        </div>
      </div>
    </section>
  );
}
