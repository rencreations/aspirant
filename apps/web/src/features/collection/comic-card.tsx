"use client";

import { useEffect, useState } from "react";

import { Frame } from "@/components/frame/frame";
import { FrameImage } from "@/components/frame/frame-image";
import { getPair } from "@/content/pairs";
import { audio } from "@/lib/audio";

import styles from "./cards.module.css";
import { COMIC_PROGRESS_EVENT, readComicPage } from "./comic-progress";
import { listPages } from "./format";
import { pairAccent } from "./frames";
import type { ComicItem } from "./types";

interface ComicCardProps {
  comic: ComicItem;
  onOpen: (comic: ComicItem, opener: HTMLElement) => void;
}

/** A webtoon strip in an arch frame. Opens the vertical reader; remembers where you stopped. */
export function ComicCard({ comic, onOpen }: ComicCardProps) {
  const [resume, setResume] = useState<number | null>(null);
  const cover = comic.pages[0];

  useEffect(() => {
    const update = () => setResume(readComicPage(comic.comicId));
    update();
    window.addEventListener(COMIC_PROGRESS_EVENT, update);
    return () => window.removeEventListener(COMIC_PROGRESS_EVENT, update);
  }, [comic.comicId]);

  if (!cover) return null;
  const pairName = comic.pair ? getPair(comic.pair).names : "";
  const showResume = resume !== null && resume > 1;

  return (
    <button
      type="button"
      className={styles.card}
      data-kind="comic"
      data-cursor="READ"
      aria-label={`Read ${comic.title}, ${comic.pageCount} pages${showResume ? `. Resume at page ${resume}` : ""}${comic.missingPages.length ? `. Pages ${listPages(comic.missingPages)} are missing from the source` : ""}`}
      onClick={(e) => {
        audio.blip("click");
        onOpen(comic, e.currentTarget);
      }}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") audio.blip("hover");
      }}
    >
      <Frame
        as="span"
        shape="arch"
        accent={pairAccent(comic.pair)}
        className={styles.frame}
        style={{ aspectRatio: 0.78 }}
      >
        <span className={styles.media}>
          <FrameImage
            src={cover.file}
            alt=""
            width={cover.width}
            height={cover.height}
            objectPosition="50% 0%"
            sizes="(min-width: 900px) 28vw, 80vw"
          />
          <span className={styles.scrim} aria-hidden="true" />
          <span className={styles.chip} data-pos="tl">
            Webtoon
          </span>
          <span className={styles.chip} data-pos="br" data-mono>
            {comic.pageCount} pages
          </span>
          <span className={styles.play} data-state="read" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M12 4v13m-5-5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </span>
        </span>
      </Frame>
      <span className={styles.meta} aria-hidden="true">
        <span className={`${styles.code} hud-label`}>
          {showResume ? `Resume at page ${resume}` : "Start at page 1"}
        </span>
        <span className={styles.title}>{comic.title}</span>
        <span className={styles.sub}>{pairName}</span>
        {comic.missingPages.length > 0 && (
          <span className={styles.credit}>
            Pages {listPages(comic.missingPages)} are missing from the source.
          </span>
        )}
      </span>
    </button>
  );
}
