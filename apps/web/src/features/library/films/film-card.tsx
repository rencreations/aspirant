"use client";

import type { CSSProperties } from "react";

import { audio } from "@/lib/audio";

import { CanonBadge } from "../shell/credit";
import { KIND_LABEL, clock, isVertical, pairName, thumbUrl } from "./film-data";
import styles from "./films.module.css";
import { TickRule } from "./tick-rule";
import type { Film } from "./types";

interface CardProps {
  film: Film;
  /** Position in its row, for the stagger of the reveal. */
  index: number;
  onOpen: (film: Film) => void;
}

/**
 * One film in a row. The picture is a flat field in the poster's own colour with the poster on
 * it, a strip of runtime ticks along the foot, and the length. Hover moves the poster only: no
 * video is read until the visitor opens the film.
 */
export function FilmCard({ film, index, onOpen }: CardProps) {
  const vertical = isVertical(film);
  const style = { "--i": Math.min(index, 9), "--field": film.c } as CSSProperties;
  return (
    <button
      type="button"
      className={styles.card}
      style={style}
      data-canon={film.canon}
      aria-label={`${film.title}. ${KIND_LABEL[film.kind]}, ${clock(film.video.dur)}. Open`}
      onClick={() => {
        audio.blip("click");
        onOpen(film);
      }}
    >
      <span className={styles.frame} data-vertical={vertical}>
        {/* A thumbnail of the library. Plain <img>: static export, art already sized. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbUrl(film)}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          width={vertical ? 270 : 480}
          height={vertical ? 480 : 270}
        />
        <span className={styles.runtime}>{clock(film.video.dur)}</span>
        <TickRule film={film} variant="strip" />
        <span className={styles.crystal} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
        </span>
      </span>
      <span className={styles.cardBody}>
        <span className={`${styles.kind} hud-label`}>
          {KIND_LABEL[film.kind]}
          {film.group ? ` ${film.group}` : ""}
        </span>
        <span className={styles.cardTitle}>{film.title}</span>
        <span className={styles.cardMeta}>
          {pairName(film.pair)}
          {film.canon === "official" ? null : <CanonBadge canon={film.canon} />}
        </span>
      </span>
    </button>
  );
}
