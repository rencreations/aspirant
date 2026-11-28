"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

import type { PlayerVideo } from "@/components/video-player/player-overlay";
import { TRAILER_FILM } from "@/features/home/fx/video-plane/data";
import { FilmBands, FilmControls } from "@/features/home/sections/strip/film-deck";
import { asset } from "@/lib/asset";

import { LABEL } from "../content";
import { usePreview } from "../sections/phase/music-preview";
import { PhasePlayer } from "../sections/phase/phase-player";

import { animateGallery } from "./series-motion";
import { SERIES, FILM_STRIPS } from "./series";
import styles from "./series.module.css";

interface Props {
  track: RefObject<HTMLDivElement | null>;
  logo: RefObject<HTMLDivElement | null>;
  start: number;
  film: PlayerVideo;
}

export function SeriesGallery({ track, logo, start, film }: Props) {
  const gallery = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLVideoElement>(null);
  const play = useRef<HTMLButtonElement>(null);
  const [watching, setWatching] = useState(false);
  usePreview(preview, frame, film.sources[0]?.src ?? "", watching);
  const origin = useCallback(() => frame.current?.getBoundingClientRect() ?? null, []);
  const open = useCallback(() => setWatching(true), []);
  const close = useCallback(() => {
    setWatching(false);
    play.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!gallery.current || !track.current || !logo.current) return;
    return animateGallery(gallery.current, track.current, logo.current, start, film.title, open);
  }, [track, logo, start, film.title, open]);

  return (
    <div ref={gallery} className={styles.gallery} data-label-part="series">
      <h2 className={styles.definition} data-definition="">
        {LABEL.definition}
      </h2>
      {SERIES.map(({ slug, name, characters, description }) => (
        <article key={slug} className={styles.panel} data-series={slug}>
          <div className={styles.poster}>
            {/* eslint-disable-next-line @next/next/no-img-element -- generated gallery poster */}
            <img
              className={styles.art}
              src={asset(`/img/about/mlabel/series/${slug}.webp`)}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className={styles.caption}>
            <h3 className={styles.mark}>
              {/* eslint-disable-next-line @next/next/no-img-element -- each series has its own wordmark */}
              <img
                src={asset(`/img/about/mlabel/series/${slug}-logo.webp`)}
                alt={name}
                loading="lazy"
                decoding="async"
              />
            </h3>
            <div className={styles.details} data-series-copy="">
              <p className={styles.cast}>
                <span className="sr-only">Characters: </span>
                {characters}
              </p>
              <p className={styles.description}>{description}</p>
            </div>
          </div>
        </article>
      ))}
      <div ref={frame} className={`${styles.panel} ${styles.film}`} data-series-film="">
        <button
          type="button"
          className={styles.crop}
          data-film-crop=""
          tabIndex={-1}
          aria-label={`Play ${film.title}`}
          aria-haspopup="dialog"
          disabled
          onClick={open}
        >
          <video
            ref={preview}
            className={styles.art}
            poster={film.poster}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
          />
        </button>
        <FilmBands aspect={TRAILER_FILM.aspect} lines={FILM_STRIPS} />
        <FilmControls
          aspect={TRAILER_FILM.aspect}
          readout={film.title}
          label="Play Films"
          playRef={play}
          initiallyDisabled
        />
        <noscript>
          <a href={film.sources[0]?.src}>Play Films</a>
        </noscript>
      </div>
      {watching
        ? createPortal(
            <PhasePlayer video={film} getOrigin={origin} onClosed={close} />,
            document.body,
          )
        : null}
    </div>
  );
}
