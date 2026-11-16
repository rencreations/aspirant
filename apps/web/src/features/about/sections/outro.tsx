"use client";

import type { CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";
import { ReportLink } from "@/features/legal/takedown/report-link";

import { OUTRO } from "../content";

import { useArrive } from "./arrive";
import { Dock } from "./dock";
import kit from "./kit.module.css";
import styles from "./outro.module.css";

const i = (n: number) => ({ "--i": n }) as CSSProperties;

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M5 12h13M12.5 6.5 18 12l-5.5 5.5" />
    </svg>
  );
}

/**
 * The close of the page: one line, the two ways on (the story and the collection), what this site
 * is, and the drone's credit under the ring where it rests before the footer. The drone is a game
 * model, so it carries the takedown link that every 3D model on the site carries.
 */
export function Outro() {
  const ref = useArrive<HTMLElement>();

  return (
    <section
      ref={ref}
      className={`${kit.section} ${styles.outro}`}
      data-about-section="outro"
      aria-labelledby="about-outro"
    >
      <div className={`${kit.inner} ${styles.inner}`}>
        <div className={styles.say} data-in="false">
          <p className={kit.eyebrow}>
            <b>06</b>
            <span>From here</span>
            <span className={kit.eyebrowRule} aria-hidden="true" />
            <span>Two ways on</span>
          </p>
          <h2 id="about-outro" className={`display ${kit.title}`}>
            <span className={kit.mask}>
              <span className={kit.line}>That is </span>
            </span>
            <span className={kit.mask}>
              <span className={kit.line} style={i(1)}>
                the <em className={styles.serif}>series.</em>
              </span>
            </span>
          </h2>
          <p className={`serif ${kit.lead} ${kit.rise}`} style={i(4)}>
            The story is told as a book on this site, one chapter to a page. Everything made for the
            series is kept in the collection.
          </p>
          <div className={styles.ways}>
            <TLink
              href={OUTRO.story.href}
              className={`${styles.pill} ${kit.rise}`}
              data-primary=""
              transitionLabel="Story"
              style={i(6)}
            >
              {OUTRO.story.label}
              <Arrow />
            </TLink>
            <TLink
              href={OUTRO.collection.href}
              className={`${styles.pill} ${kit.rise}`}
              transitionLabel="Collection"
              style={i(7)}
            >
              {OUTRO.collection.label}
              <Arrow />
            </TLink>
          </div>
        </div>

        <div className={styles.rest}>
          <Dock anchor="outro" face="sleepy" size="large">
            <b>The drone</b>
            {OUTRO.credit} <ReportLink item={OUTRO.model} className={styles.report} />
          </Dock>
        </div>

        <p className={styles.notice} data-in="false">
          <span className={kit.rule} aria-hidden="true" />
          <span className={kit.rise}>{OUTRO.notice}</span>
        </p>
      </div>
    </section>
  );
}
