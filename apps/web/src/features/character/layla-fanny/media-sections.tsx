"use client";

import { useRef, useState } from "react";

import { ImageViewer, type ViewerImage } from "@/components/image-viewer/image-viewer";
import { VideoCard } from "@/components/video-player/video-card";
import { formatTime } from "@/components/video-player/player-math";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { toggleMusic, useNowPlaying } from "@/lib/now-playing";
import { CONFIG } from "./config";
import styles from "./lf.module.css";
import { FILMS, PAIR_OFFICIAL, officialArt, sourcesOf, type Film, type Who } from "./media";
import { Head, Reveal } from "./parts";

export interface Fan {
  id: string;
  title: string;
  credit: string;
  url: string | null;
  src: string;
  srcSm: string;
  width: number;
  height: number;
}

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

/** 04. The three films about the two of them. Nothing plays until it is pressed. */
export function Films({ who }: { who: Who }) {
  return (
    <section
      id="films"
      className={styles.films}
      data-who={who}
      data-theme="daybreak"
      aria-labelledby="lf-films"
    >
      <Head
        no={4}
        label="Films"
        title="Films"
        lead="The trailer, the skins in motion and a short animation. Each one opens in the full player."
        id="lf-films"
      />
      <div className={styles.filmGrid}>
        <Reveal>
          <FilmCard film={FILMS.trailer} who={who} tag="Trailer" />
        </Reveal>
        <Reveal delay={1}>
          <FilmCard film={FILMS.skin} who={who} tag="Skins" />
        </Reveal>
        <Reveal delay={2}>
          <FilmCard film={FILMS.short} who={who} tag="Short" />
        </Reveal>
      </div>
    </section>
  );
}

function creditOf(f: Fan): ViewerImage["credit"] {
  const [name, platform] = f.credit.split(" on ");
  return {
    name: name ?? f.credit,
    platform: platform ?? "Fan art",
    ...(f.url ? { href: f.url } : {}),
  };
}

/** 05. Official art, then fan art with the artist's credit. A press opens the site's viewer. */
export function Gallery({ who, fanart }: { who: Who; fanart: readonly Fan[] }) {
  const official = officialArt(who);
  const [open, setOpen] = useState<number | null>(null);

  const items: ViewerImage[] = [
    ...official.map((a): ViewerImage => ({
      src: a.src,
      thumb: a.src,
      alt: a.alt,
      width: a.width,
      height: a.height,
      title: a.title,
      set: "official",
      setLabel: "Official art",
      credit: { name: "Moonton", platform: "Mobile Legends: Bang Bang" },
    })),
    ...fanart.map((f): ViewerImage => ({
      src: f.src,
      thumb: f.srcSm,
      alt: `${f.title}, fan art`,
      width: f.width,
      height: f.height,
      title: f.title,
      set: `fan-${f.id}`,
      setLabel: `Fan art by ${creditOf(f).name}`,
      credit: creditOf(f),
    })),
  ];

  const press = (i: number) => {
    audio.blip("click");
    setOpen(i);
  };

  return (
    <section
      id="gallery"
      className={styles.gallery}
      data-who={who}
      data-theme="daybreak"
      aria-labelledby="lf-gallery"
    >
      <Head
        no={5}
        label="Gallery"
        title="Gallery"
        lead="Official art first. Fan art follows, always with the artist's credit."
        id="lf-gallery"
      />
      <ul className={styles.official}>
        {official.map((a, i) => (
          <li key={a.src} data-wide={a.width > a.height}>
            <button
              type="button"
              className={styles.tile}
              onClick={() => {
                press(i);
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
                draggable={false}
              />
              <span>{a.title}</span>
            </button>
          </li>
        ))}
      </ul>
      <h3 className={styles.sub}>Fan art</h3>
      <ul className={styles.fans}>
        {fanart.map((f, i) => (
          <li key={f.id}>
            <button
              type="button"
              className={styles.fan}
              onClick={() => {
                press(official.length + i);
              }}
              data-cursor="VIEW"
              aria-label={`Open ${f.title}, fan art by ${creditOf(f).name}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset(f.srcSm)}
                alt=""
                width={f.width}
                height={f.height}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
              <span>{creditOf(f).name}</span>
            </button>
          </li>
        ))}
      </ul>
      <ImageViewer
        items={items}
        index={open}
        onIndexChange={setOpen}
        label={`${who === "layla" ? "Layla" : "Fanny"} gallery`}
        skin={CONFIG[who].viewer}
      />
    </section>
  );
}

/** 06. We Believe. The music plays from the layout; this is its record, a switch and its films. */
export function Music({ who }: { who: Who }) {
  const { playing } = useNowPlaying();
  const root = useRef<HTMLElement>(null);
  return (
    <section
      ref={root}
      id="music"
      className={styles.music}
      data-who={who}
      data-theme="storm"
      aria-labelledby="lf-music"
    >
      <Head
        no={6}
        label="Music"
        title="We Believe"
        lead="The theme of the series. It plays on both pages and does not stop when you move from one to the other."
        id="lf-music"
      />
      <div className={styles.musicTop}>
        <Reveal className={styles.recordWrap}>
          <div className={styles.record} data-playing={playing}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset(PAIR_OFFICIAL)}
              alt=""
              width={1000}
              height={563}
              draggable={false}
              loading="lazy"
            />
          </div>
        </Reveal>
        <Reveal className={styles.musicText} delay={1}>
          <p>The sound button in the bar mutes it. The record in the bar pauses it too.</p>
          <button
            type="button"
            className={styles.pill}
            aria-pressed={playing}
            onClick={() => {
              audio.blip("click");
              toggleMusic();
            }}
            data-cursor={playing ? "PAUSE" : "PLAY"}
          >
            {playing ? "Pause the music" : "Play the music"}
          </button>
        </Reveal>
      </div>
      <div className={styles.musicFilms}>
        <Reveal>
          <FilmCard film={FILMS.music} who={who} tag="Music video" />
        </Reveal>
        <Reveal delay={1}>
          <FilmCard film={FILMS.musicBts} who={who} tag="Making of" />
        </Reveal>
        <Reveal delay={2}>
          <FilmCard film={FILMS.producer} who={who} tag="Producer" />
        </Reveal>
        <Reveal delay={3}>
          <FilmCard film={FILMS.idea} who={who} tag="The idea" />
        </Reveal>
      </div>
    </section>
  );
}
