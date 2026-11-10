"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { ThemeZone } from "@/components/theme-zone";
import { TLink } from "@/components/transition/t-link";
import { libUrl } from "@/lib/library";

import { fetchLibraryJson } from "../data";
import { getCollection } from "../registry";
import { TAKEDOWN_URL } from "../shell/library-shell";
import { BackToCollection } from "../shell/room-chrome";
import { textOn } from "../shelf/layout";
import { VIDEO_HALVES, halfCounts } from "../shelf/video-halves";
import styles from "./chooser.module.css";
import { FILM_IDS } from "./links";

/** Where a fan or a rights holder asks for a takedown (the same address as every room's footer). */

interface LibraryIndex {
  counts?: Record<string, number>;
  rooms?: Record<string, number>;
}

/**
 * `/collection/video`: the two rooms of the Video collection, Films and Others, as two large
 * tiles. On the shelf the Video cover opens into these two halves inside the scene; this page is
 * what a direct visit, a visitor without WebGL and a crawler get. The tiles are the same pictures
 * as the halves, with the number and the name laid over them in the shelf's type.
 */
export default function VideoChooser() {
  const meta = getCollection("video");
  const [index, setIndex] = useState<LibraryIndex>({});

  useEffect(() => {
    let live = true;
    fetchLibraryJson<LibraryIndex>("/data/library/index.json").then(
      (data) => {
        if (live) setIndex(data);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);

  const counts = halfCounts(index.counts?.video, FILM_IDS.length, {
    films: index.rooms?.["video/films"],
    others: index.rooms?.["video/others"],
  });
  const countText = [
    counts[0] !== undefined ? `${counts[0]} films` : "",
    counts[1] !== undefined ? `${counts[1].toLocaleString("en-US")} videos` : "",
  ];

  return (
    <ThemeZone theme="daybreak" as="div" className={styles.page}>
      <BackToCollection tone="dark" />
      <main className={`${styles.main} shell`}>
        <header className={styles.head}>
          <p className={styles.num}>{meta.index}</p>
          <h1 className={styles.title}>{meta.name}</h1>
          <p className={styles.line}>{meta.line}</p>
        </header>

        <ul className={styles.tiles}>
          {VIDEO_HALVES.map((h, k) => (
            <li key={h.room}>
              <TLink
                href={h.href}
                transitionLabel={h.name}
                className={styles.tile}
                data-video-tile={h.room}
                style={{ "--field": h.colour, "--ink": textOn(h.colour) } as CSSProperties}
              >
                <span className={styles.art}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={libUrl(h.cover)}
                    alt=""
                    width={1024}
                    height={1024}
                    crossOrigin="anonymous"
                    decoding="async"
                  />
                  <span className={styles.artNum} aria-hidden="true">
                    {h.index}
                  </span>
                  <span className={styles.artName} aria-hidden="true">
                    {h.name}
                  </span>
                </span>
                <div className={styles.caption}>
                  <h2 className="sr-only">{h.name}</h2>
                  <span className={styles.tileLine}>{h.line}</span>
                  <span className={styles.row}>
                    <span className={styles.count}>{countText[k]}</span>
                    <span className={styles.open} aria-hidden="true">
                      Open
                      <svg viewBox="0 0 16 16" width="12" height="12">
                        <path
                          d="M6 3l5 5-5 5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                      </svg>
                    </span>
                  </span>
                </div>
              </TLink>
            </li>
          ))}
        </ul>

        <footer className={styles.foot}>
          <p>
            A fan made archive. Aspirant and Mobile Legends: Bang Bang belong to Moonton, and this
            site is not affiliated with them. To ask for something to be taken down, open an issue
            at{" "}
            <TLink href={TAKEDOWN_URL} className="link">
              the project page
            </TLink>
            .
          </p>
        </footer>
      </main>
    </ThemeZone>
  );
}
