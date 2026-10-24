"use client";

import { useRef, useState } from "react";

import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useInView } from "@/lib/hooks";

import { comicPage, videoPoster } from "../media";
import { COMIC_COUNT } from "../shared/info";
import { PlayerButton, videoFor } from "../shared/player-button";
import { ComicReader } from "./comic-reader";
import styles from "./comics.module.css";

/** The pages that make the fan on the Read card. */
const FAN = [1, 2, 4] as const;

/**
 * "Read it or watch it?": the comic of Guinevere and Vexana, in two ways. Watch plays the voiced
 * Japanese cut in the site's player. Read opens the web reader with every page. The two cards
 * grow toward the pointer, and the one that is not chosen steps back.
 */
export function Comics() {
  const [reading, setReading] = useState(false);
  const root = useRef<HTMLElement>(null);
  const seen = useInView(root, { threshold: 0.2, once: true });

  return (
    <section
      ref={root}
      id="comics"
      className={styles.comics}
      data-theme="daybreak"
      data-seen={seen}
      aria-labelledby="comics-title"
    >
      <header className={styles.head}>
        <p className={styles.kicker}>The comic</p>
        <h2 id="comics-title" className={styles.title}>
          <span>Read it.</span>
          <span className={styles.serif}>Or watch it.</span>
        </h2>
        <p className={styles.lede}>
          The night Vexana was taken, drawn page by page. Choose your way in. Same story, same
          ending.
        </p>
      </header>

      <div className={styles.choices}>
        <PlayerButton
          className={`${styles.choice} ${styles.watch}`}
          label="Watch the comic, voiced in Japanese"
          video={videoFor("comic-jp", "Guinevere and Vexana, the comic")}
        >
          <span className={styles.step}>01</span>
          <span className={styles.screen}>
            {/* Plain <img>: static export. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(videoPoster("comic-jp"))} alt="" loading="lazy" draggable={false} />
            <span className={styles.playDot} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </span>
          </span>
          <span className={styles.label}>
            <b>Watch</b>
            <small>2 min 12 s, voiced in Japanese</small>
          </span>
        </PlayerButton>

        <button
          type="button"
          className={`${styles.choice} ${styles.read}`}
          aria-haspopup="dialog"
          data-cursor="READ"
          onPointerEnter={() => {
            audio.blip("hover");
          }}
          onClick={() => {
            setReading(true);
          }}
        >
          <span className={styles.step}>02</span>
          <span className={styles.fan} aria-hidden="true">
            {FAN.map((n, i) => (
              <span key={n} className={styles.sheet} style={{ ["--i" as string]: i }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset(comicPage(n))}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              </span>
            ))}
          </span>
          <span className={styles.label}>
            <b>Read</b>
            <small>{COMIC_COUNT} pages, scroll or turn them</small>
          </span>
        </button>
      </div>

      <ComicReader open={reading} onOpenChange={setReading} />
    </section>
  );
}
