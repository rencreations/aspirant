"use client";

import { TLink } from "@/components/transition/t-link";
import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";

import { TAKEDOWN_URL } from "../shell/library-shell";
import { videoHref } from "../video/links";
import { downloadFile } from "../voicelines/download";
import { Icon } from "../voicelines/icons";
import { clock, discUrl, downloadName, infoRows, KIND_LABEL } from "./logic";
import styles from "./music.module.css";
import { playAt, playTrack, usePlayer } from "./player-store";
import type { MusicItem } from "./types";

function Row({ item, list }: { item: MusicItem; list: readonly MusicItem[] }) {
  const current = usePlayer((s) => s.track?.id === item.id);
  const playing = usePlayer((s) => s.playing && s.track?.id === item.id);
  return (
    <li id={item.id} className={styles.plainItem} data-current={current ? "true" : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.plainDisc}
        src={discUrl(item)}
        alt=""
        width={160}
        height={160}
        loading="lazy"
        decoding="async"
      />
      <div className={styles.plainBody}>
        <p className={styles.plainKicker}>
          {[item.ep, KIND_LABEL[item.kind], clock(item.dur)].filter(Boolean).join("  ·  ")}
        </p>
        <h2 className={styles.plainTitle}>{item.title}</h2>
        <dl className={styles.plainRows}>
          {infoRows(item).map((r) => (
            <div key={`${r.label}-${r.value}`}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
        {item.about ? <p className={styles.plainAbout}>{item.about}</p> : null}
        <div className={styles.plainActions}>
          <button
            type="button"
            className={`${styles.pill} ${styles.primary}`}
            aria-pressed={playing}
            aria-label={`${playing ? "Pause" : "Play"} ${item.title}`}
            onClick={() => {
              audio.unlock();
              playTrack(item, list);
            }}
          >
            <Icon name={playing ? "pause" : "play"} />
            <span>{playing ? "Pause" : "Play"}</span>
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
          {item.films.map((f) => (
            <TLink
              key={f.id}
              href={videoHref(f.id, f.t)}
              transitionLabel="Video"
              className={styles.pill}
            >
              <Icon name="film" />
              <span>{f.label}</span>
            </TLink>
          ))}
        </div>
        {item.chapters ? (
          <ol className={styles.plainChapters} aria-label="Tracks in this listen">
            {item.chapters.map((c) => (
              <li key={c.t}>
                <button
                  type="button"
                  className={styles.chapter}
                  onClick={() => {
                    audio.unlock();
                    playAt(item, c.t, list);
                  }}
                >
                  <span className={styles.chapterTime}>{clock(c.t)}</span>
                  <span>{c.title}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </li>
  );
}

interface Props {
  items: readonly MusicItem[] | null;
  failed: boolean;
  /** The page heading lives here when the scene does not run. */
  heading: boolean;
}

/**
 * The tracks as a plain list: the page itself when WebGL is missing (a failure, not a version),
 * and always in the HTML for crawlers and for visitors without scripts. Every track can be
 * played, downloaded and followed to its films from here too.
 */
export function TrackList({ items, failed, heading }: Props) {
  return (
    <section className={styles.plain} aria-labelledby="music-plain-head">
      {heading ? (
        <h1 id="music-plain-head" className={styles.plainHead}>
          Music
        </h1>
      ) : (
        <h2 id="music-plain-head" className="sr-only">
          The tracks
        </h2>
      )}
      <p className={styles.plainLead}>
        The songs, the page themes and the long listens of The Aspirants, with their credits.
      </p>
      {items ? (
        <ol className={styles.plainList}>
          {items.map((item) => (
            <Row key={item.id} item={item} list={items} />
          ))}
        </ol>
      ) : (
        <p className={styles.plainLead} role="status">
          {failed
            ? "The music could not be read. Reload the page to try again."
            : "Reading the music."}
        </p>
      )}
      <p className={styles.plainNote}>
        A fan made archive. The tracks belong to Moonton and the people who made them. To ask for a
        takedown,{" "}
        <a href={TAKEDOWN_URL} target="_blank" rel="noopener noreferrer" className="link">
          open an issue
        </a>
        .
      </p>
    </section>
  );
}
