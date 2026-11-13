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
