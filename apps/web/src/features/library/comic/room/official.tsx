"use client";

import type { Route } from "next";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

import { TLink } from "@/components/transition/t-link";
import { useTransitionRouter } from "@/components/transition/transition-provider";

import { comicPath } from "../route";
import type { ComicItem, StagePanel } from "../types";
import { startComicJob, warmComic } from "../zoom/store";
import styles from "./official.module.css";

interface Props {
  id: string;
  comic: ComicItem;
  /** The comic's first panel, as the stage shows it: the press on the button zooms into it. */
  first?: StagePanel;
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
export function OfficialSection({ id, comic, first, tone, children }: Props) {
  const pages = comic.pages.length;
  const root = useRef<HTMLElement>(null);
  const router = useTransitionRouter();
  const href = comicPath(comic.slug);

  // Warm the comic's page and the layer's code once the section is on the screen, so a press starts at once.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        warmComic(href);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [href]);

  // A plain press dives into the first panel. A modified press (a new tab) is left to the browser.
  const open = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // Offline, or while another change runs, the link behaves as every link does (the router's notice, or nothing).
    if (!router.canOpen(href as Route) || router.isTransitioning()) return;
    const section = root.current;
    const stage = section?.querySelector<HTMLElement>("[data-stage]");
    const img = section?.querySelector<HTMLImageElement>('[data-part="first"] img');
    if (!section || !stage || !img || !first?.at) return;
    e.preventDefault();
    startComicJob({ kind: "dive", href, comic, section, stage, img, panel: first });
  };
  return (
    <section
      ref={root}
      id={id}
      className={styles.section}
      data-tone={tone}
      aria-label={comic.title}
    >
      <div className={styles.dots} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.stage}>{children}</div>
        <div className={styles.row} data-dive="row">
          <TLink
            href={href as never}
            transitionLabel={comic.title}
            onClick={open}
            onPointerEnter={() => {
              warmComic(href);
            }}
            className={styles.cta}
            data-cta={tone}
          >
            <span className={styles.ctaText}>Read the comics</span>
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
