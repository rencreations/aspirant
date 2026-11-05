"use client";

import type { Route } from "next";
import { memo, type CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";
import { libUrl } from "@/lib/library";
import { collectionRoute } from "@/lib/site";

import { downloadFile } from "../voicelines/download";
import { Icon } from "../voicelines/icons";
import { clock, coverUrl, downloadName, KIND_LABELS } from "./logic";
import styles from "./music.module.css";
import { addToQueue, playAt, playNext, playTrack, usePlayer } from "./player-store";
import { Spectrum } from "./spectrum";
import type { MusicItem } from "./types";

interface TrackRowProps {
  item: MusicItem;
  index: number;
  list: readonly MusicItem[];
  /** The row a link pointed at. */
  target: boolean;
}

function filmHref(id: string, t?: number): Route {
  const time = t ? `&t=${Math.floor(t)}` : "";
  return `${collectionRoute("films")}?i=${id}${time}` as Route;
}

/** One track in the list: cover, title, credits, the chapters of a long listen, related films and the actions. */
export const TrackRow = memo(function TrackRow({ item, index, list, target }: TrackRowProps) {
  const current = usePlayer((s) => s.track?.id === item.id);
  const playing = usePlayer((s) => s.playing && s.track?.id === item.id);
  const queued = usePlayer((s) => s.queue.some((t) => t.id === item.id));

  return (
    <li
      id={item.id}
      className={styles.row}
      data-current={current}
      data-playing={playing}
      data-target={target}
      style={{ "--i": index } as CSSProperties}
    >
      <button
        type="button"
        className={styles.rowPlay}
        aria-label={`${playing ? "Pause" : "Play"} ${item.title}`}
        aria-pressed={playing}
        onClick={() => {
          playTrack(item, list);
        }}
      >
        <Icon name={playing ? "pause" : "play"} />
      </button>

      <span className={styles.rowCover} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverUrl(item.cover, "t")}
          alt=""
          width={160}
          height={160}
          loading="lazy"
          decoding="async"
        />
      </span>

      <div className={styles.rowInfo}>
        <p className={`${styles.rowKicker} hud-label`}>
          {item.ep ? <span className={styles.rowEp}>{item.ep}</span> : null}
          <span>{KIND_LABELS[item.kind]}</span>
          {item.released ? <span>Released {item.released}</span> : null}
        </p>
        <h3 className={`${styles.rowTitle} display`}>{item.title}</h3>
        <p className={styles.rowAbout}>{item.about}</p>

        {item.credits.length > 0 ? (
          <dl className={styles.credits}>
            {item.credits.map((c) => (
              <div key={`${c.role}-${c.name}`}>
                <dt className="hud-label">{c.role}</dt>
                <dd>{c.name}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className={`${styles.noCredit} hud-label`}>Credit not named in the sources</p>
        )}

        {item.chapters ? (
          <ol className={styles.chapters} aria-label="Tracks in this listen">
            {item.chapters.map((c) => (
              <li key={c.t}>
                <button
                  type="button"
                  className={styles.chapter}
                  onClick={() => {
                    playAt(item, c.t, list);
                  }}
                >
                  <span className="hud-label">{clock(c.t)}</span>
                  <span>{c.title}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : null}

        {item.films.length > 0 ? (
          <p className={styles.films}>
            <span className="hud-label">Watch</span>
            {item.films.map((f) => (
              <TLink
                key={f.id}
                href={filmHref(f.id, f.t)}
                transitionLabel="Films"
                className={styles.filmLink}
              >
                <Icon name="film" />
                <span>{f.label}</span>
              </TLink>
            ))}
          </p>
        ) : null}
      </div>

      <div className={styles.rowMeta}>
        {playing ? (
          <Spectrum playing bars={20} className={styles.rowWave} />
        ) : (
          <span className={`${styles.rowTime} hud-label`}>{clock(item.dur)}</span>
        )}
        <span className={styles.rowActions}>
          <button
            type="button"
            className={styles.pill}
            aria-pressed={queued && !current}
            disabled={current}
            onClick={() => {
              if (queued) playNext(item);
              else addToQueue(item);
            }}
            title={queued ? "Move to play next" : "Add to the queue"}
          >
            <Icon name="plus" />
            <span>{queued ? "Play next" : "Queue"}</span>
          </button>
          <a
            className={styles.pill}
            href={libUrl(item.orig ?? item.src)}
            download={downloadName(item)}
            aria-label={`Download ${item.title}`}
            onClick={(e) => {
              e.preventDefault();
              void downloadFile(libUrl(item.orig ?? item.src), downloadName(item));
            }}
          >
            <Icon name="download" />
            <span>{item.orig ? "Original" : "Download"}</span>
          </a>
        </span>
        <p className={styles.quality}>{item.quality}</p>
      </div>
    </li>
  );
});
