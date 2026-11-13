"use client";

import type { ReactNode } from "react";

import { TLink } from "@/components/transition/t-link";

import { comicPath } from "../route";
import type { ComicItem } from "../types";
import styles from "./official.module.css";

interface Props {
  id: string;
  comic: ComicItem;
  /** `as` for The Aspirant (coral and ink), `vg` for Guinevere and Vexana (purple and gold). */
  tone: "as" | "vg";
  /** The stage. */
  children: ReactNode;
}

/**
 * One whole screen for one official comic: its stage in the middle, a little above the centre, and one
 * big button under it that opens the comic at its own page. The button is made for each section, in
 * the colours of its stage.
 */
export function OfficialSection({ id, comic, tone, children }: Props) {
  const pages = comic.pages.length;
  return (
    <section id={id} className={styles.section} data-tone={tone} aria-label={comic.title}>
      <div className={styles.dots} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.stage}>{children}</div>
        <div className={styles.row}>
          <TLink
            href={comicPath(comic.slug) as never}
            transitionLabel={comic.title}
            className={styles.cta}
            data-cta={tone}
          >
            <span className={styles.ctaText}>Read the comic</span>
            <span className={styles.ctaArrow} aria-hidden="true">
              <svg viewBox="0 0 20 20" width="22" height="22">
                <path
                  d="M3 10h13M11 4l6 6-6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </TLink>
          <p className={`${styles.meta} hud-label`}>
            <span>{comic.title}</span>
            <span className={styles.sep} aria-hidden="true" />
            <span>{pages} pages</span>
            {comic.transcript ? (
              <>
                <span className={styles.sep} aria-hidden="true" />
                <span>With text</span>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </section>
  );
}
