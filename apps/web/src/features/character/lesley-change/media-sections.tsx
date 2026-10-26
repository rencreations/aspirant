"use client";

import { useState } from "react";

import { ImageViewer, type ViewerImage } from "@/components/image-viewer/image-viewer";
import { formatTime } from "@/components/video-player/player-math";
import { VideoCard } from "@/components/video-player/video-card";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { CONFIG } from "./config";
import styles from "./lc.module.css";
import { FILMS, officialArt, sourcesOf, type Film, type Who } from "./media";
import { Head, Reveal } from "./parts";

function FilmCard({ film, who, tag }: { film: Film; who: Who; tag: string }) {
  return (
    <figure className={styles.film}>
      <VideoCard
        className={styles.filmCard}
        tag={tag}
        duration={film.durationSec}
        video={{
          sources: sourcesOf(film),
          poster: film.poster,
          title: film.title,
          ...(film.captions ? { captions: film.captions } : {}),
          skin: CONFIG[who].skin,
        }}
      />
      <figcaption>
        <b>{film.title}</b>
        <span>{film.note}</span>
        <em>{formatTime(film.durationSec)}</em>
      </figcaption>
    </figure>
  );
}

/** 04. The trailer, the teaser and the skins. Nothing plays until it is pressed. */
export function Films({ who }: { who: Who }) {
  return (
    <section
      id="films"
      className={styles.films}
      data-who={who}
      data-theme="daybreak"
      aria-labelledby="lc-films"
    >
      <Head
        no={4}
        label="Films"
        title="Films"
        lead="The trailer, the teaser and the skins in motion. Each one opens in the full player."
        id="lc-films"
      />
      <div className={styles.filmGrid}>
        <Reveal>
          <FilmCard film={FILMS.trailer} who={who} tag="Trailer" />
        </Reveal>
        <Reveal delay={1}>
          <FilmCard film={FILMS.teaser} who={who} tag="Teaser" />
        </Reveal>
        <Reveal delay={2}>
          <FilmCard film={FILMS.skin} who={who} tag="Skins" />
        </Reveal>
      </div>
    </section>
  );
}

/** 05. The official art of the pair. A press opens the site's viewer. */
export function Gallery({ who }: { who: Who }) {
  const official = officialArt(who);
  const [open, setOpen] = useState<number | null>(null);

  const items: ViewerImage[] = official.map((a): ViewerImage => ({
    src: a.src,
    thumb: a.src,
    alt: a.alt,
    width: a.width,
    height: a.height,
    title: a.title,
    set: "official",
    setLabel: "Official art",
    credit: { name: "Moonton", platform: "Mobile Legends: Bang Bang" },
  }));

  return (
    <section
      id="gallery"
      className={styles.gallery}
      data-who={who}
      data-theme="daybreak"
      aria-labelledby="lc-gallery"
    >
      <Head
        no={5}
        label="Gallery"
        title="Gallery"
        lead="The official splash arts of the pair, one for each of them."
        id="lc-gallery"
      />
      <ul className={styles.official}>
        {official.map((a, i) => (
          <li key={a.src}>
            <button
              type="button"
              className={styles.tile}
              onClick={() => {
                audio.blip("click");
                setOpen(i);
              }}
              data-cursor="VIEW"
              aria-label={`Open ${a.alt}`}
            >
              {/* Plain <img>: static export, art already sized. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset(a.src)}
                alt=""
                width={a.width}
                height={a.height}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
              <span>{a.title}</span>
            </button>
          </li>
        ))}
      </ul>
      <ImageViewer
        items={items}
        index={open}
        onIndexChange={setOpen}
        label={`${who === "lesley" ? "Lesley" : "Chang'e"} gallery`}
        skin={CONFIG[who].viewer}
      />
    </section>
  );
}
