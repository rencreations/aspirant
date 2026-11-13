"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";
import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";

import { CanonBadge, CreditLine } from "../shell/credit";
import { comicPath } from "./route";
import styles from "./shelf.module.css";
import type { ComicItem } from "./types";

/**
 * The page-flip count of a cover: while `active` it counts up to `n` in a short run, writing the
 * number straight into the element, and it shows the real number again when it stops.
 */
function FlipCount({ n, active }: { n: number; active: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 700);
      el.textContent = String(Math.max(1, Math.round(1 + (n - 1) * (1 - Math.pow(1 - k, 3)))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.textContent = String(n);
    };
  }, [active, n]);
  return <span ref={ref}>{n}</span>;
}

interface CardProps {
  comic: ComicItem;
  index: number;
  /** The page the visitor reached last, when they have started it. */
  resume: number | null;
}

function pagesLabel(comic: ComicItem): string {
  const n = comic.pages.length;
  const missing = comic.missing.length;
  return missing > 0 ? `${n} pages, ${missing} missing in the source` : `${n} pages`;
}

/** One of the two official webtoons: a book that tilts open, a strip of its first page that runs on hover. */
export function OfficialCard({ comic, index, resume }: CardProps) {
  const first = comic.pages[0];
  const [hot, setHot] = useState(false);
  const showResume = resume !== null && resume > 1;
  return (
    <TLink
      href={comicPath(comic.slug) as never}
      transitionLabel={comic.title}
      className={styles.official}
      style={{ "--i": index } as CSSProperties}
      aria-label={`Read ${comic.title}. ${pagesLabel(comic)}${comic.transcript ? ", with a transcript" : ""}${showResume ? `. Resume at page ${resume}` : ""}`}
      onPointerEnter={() => {
        audio.blip("hover");
        setHot(true);
      }}
      onPointerLeave={() => {
        setHot(false);
      }}
      onFocus={() => {
        setHot(true);
      }}
      onBlur={() => {
        setHot(false);
      }}
    >
      <span className={styles.book}>
        <span className={styles.stack} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className={styles.cover}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={libUrl(comic.cover.p)}
            width={comic.cover.w}
            height={comic.cover.h}
            alt=""
            decoding="async"
          />
          <span className={`${styles.spine} display`} aria-hidden="true">
            {comic.title}
          </span>
        </span>
      </span>

      <span className={styles.text}>
        <span className={`${styles.kicker} hud-label`}>Official webtoon</span>
        <span className={`${styles.name} display`}>{comic.title}</span>
        <span className={styles.desc}>{comic.description}</span>
        <span className={`${styles.meta} hud-label`}>
          <span>
            <span className={styles.count}>
              <FlipCount n={comic.pages.length} active={hot} />
            </span>{" "}
            pages
          </span>
          {comic.missing.length > 0 ? (
            <span>{comic.missing.length} missing in the source</span>
          ) : null}
          {comic.transcript ? <span>With transcript</span> : null}
        </span>
        <span className={styles.cta}>
          {showResume ? `Resume at page ${resume}` : "Read"}
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" fill="none" />
          </svg>
        </span>
      </span>

      {first ? (
        <span className={styles.panels} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={libUrl(first.t)}
            width={first.w}
            height={first.h}
            alt=""
            loading="lazy"
            decoding="async"
          />
        </span>
      ) : null}
    </TLink>
  );
}

/** A fan comic: the cover leans open on hover, and the credit is always under it. */
export function FanCard({ comic, index, resume }: CardProps) {
  const [hot, setHot] = useState(false);
  const showResume = resume !== null && resume > 1;
  return (
    <article className={styles.fan} style={{ "--i": index } as CSSProperties}>
      <TLink
        href={comicPath(comic.slug) as never}
        transitionLabel={comic.title}
        className={styles.fanOpen}
        aria-label={`Read ${comic.title}, a fan comic. ${pagesLabel(comic)}${showResume ? `. Resume at page ${resume}` : ""}`}
        onPointerEnter={() => {
          audio.blip("hover");
          setHot(true);
        }}
        onPointerLeave={() => {
          setHot(false);
        }}
        onFocus={() => {
          setHot(true);
        }}
        onBlur={() => {
          setHot(false);
        }}
      >
        <span className={styles.fanBook}>
          <span className={styles.stack} aria-hidden="true">
            <i />
            <i />
          </span>
          <span className={styles.fanCover} style={{ background: comic.cover.c }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={libUrl(comic.cover.t)}
              width={comic.cover.w}
              height={comic.cover.h}
              alt=""
              loading="lazy"
              decoding="async"
            />
            <span className={styles.fanBadge}>
              <CanonBadge canon={comic.canon} />
            </span>
            <span className={`${styles.fanPages} hud-label`}>
              <FlipCount n={comic.pages.length} active={hot} />{" "}
              {comic.pages.length === 1 ? "page" : "pages"}
            </span>
          </span>
        </span>
        <span className={`${styles.fanTitle} display`}>{comic.title}</span>
        <span className={styles.fanDesc}>{comic.description}</span>
        {showResume ? (
          <span className={`${styles.resume} hud-label`}>Resume at page {resume}</span>
        ) : null}
      </TLink>
      <div className={styles.fanFoot}>
        <CreditLine credit={comic.credit} canon={comic.canon} />
      </div>
    </article>
  );
}
