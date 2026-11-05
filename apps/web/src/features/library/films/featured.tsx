"use client";

import type { CSSProperties } from "react";

import { audio } from "@/lib/audio";

import {
  KIND_LABEL,
  aspectOf,
  clock,
  dateWords,
  pairName,
  posterUrl,
  sizeWords,
} from "./film-data";
import styles from "./films.module.css";
import { TickRule } from "./tick-rule";
import type { Film } from "./types";

interface FeaturedProps {
  film: Film;
  /** Open the film. `play` also presses play in the cinema view. */
  onOpen: (film: Film, play: boolean) => void;
}

/**
 * The film the room opens with: a big poster in a frame with corner marks, a play button, and the
 * runtime ruler with a tick for each scene. The play button opens the film and starts the player,
 * so it is always the visitor's press that starts a film.
 */
export function Featured({ film, onOpen }: FeaturedProps) {
  const ratio = Math.min(2.4, Math.max(16 / 9, aspectOf(film)));
  const style = { "--ratio": ratio, "--field": film.c } as CSSProperties;
  const date = dateWords(film.date);
  return (
    <section className={`${styles.featured} shell`} aria-labelledby="featured-title" style={style}>
      <div className={styles.featuredText}>
        <p className={`${styles.eyebrow} hud-label`}>
          <span className={styles.eyebrowMark} aria-hidden="true" />
          Now showing
        </p>
        <h2 id="featured-title" className={`${styles.featuredTitle} display`}>
          {film.title}
        </h2>
        <p className={styles.lead}>{film.desc}</p>
        <dl className={`${styles.facts} hud-label`}>
          <div>
            <dt>Kind</dt>
            <dd>{KIND_LABEL[film.kind]}</dd>
          </div>
          <div>
            <dt>Runs</dt>
            <dd>{clock(film.video.dur)}</dd>
          </div>
          <div>
            <dt>Pair</dt>
            <dd>{pairName(film.pair)}</dd>
          </div>
          <div>
            <dt>Scenes</dt>
            <dd>{film.chapters.length}</dd>
          </div>
          {date ? (
            <div>
              <dt>Posted</dt>
              <dd>{date}</dd>
            </div>
          ) : null}
        </dl>
        <div className={styles.featuredActions}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              audio.blip("click");
              onOpen(film, true);
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
            </svg>
            <span>Play the film</span>
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              audio.blip("click");
              onOpen(film, false);
            }}
          >
            <span>Scenes and details</span>
          </button>
        </div>
      </div>

      <button
        type="button"
        className={styles.featuredFrame}
        aria-label={`Play ${film.title}`}
        data-cursor="PLAY"
        onClick={() => {
          audio.blip("click");
          onOpen(film, true);
        }}
      >
        <span className={styles.bracket} data-corner="tl" aria-hidden="true" />
        <span className={styles.bracket} data-corner="tr" aria-hidden="true" />
        <span className={styles.bracket} data-corner="bl" aria-hidden="true" />
        <span className={styles.bracket} data-corner="br" aria-hidden="true" />
        <span className={styles.featuredPicture}>
          {/* Plain <img>: static export, art already sized. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={posterUrl(film)}
            alt=""
            decoding="async"
            fetchPriority="high"
            draggable={false}
            width={1280}
            height={Math.round(1280 / ratio)}
          />
          <span className={styles.bigPlay} aria-hidden="true">
            <span className={styles.bigPlayRing} />
            <span className={styles.bigPlayCrystal}>
              <svg viewBox="0 0 24 24" width="30" height="30">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </span>
          </span>
        </span>
        <span className={styles.featuredFoot} aria-hidden="true">
          <span className="hud-label">
            {film.video.w} x {film.video.h}
          </span>
          <TickRule film={film} variant="line" />
          <span className="hud-label">{sizeWords(film.bytes)}</span>
        </span>
      </button>
    </section>
  );
}
