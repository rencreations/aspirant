"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { VideoCard } from "@/components/video-player/video-card";
import { ReportLink } from "@/features/legal/takedown/report-link";
import { formatTime } from "@/components/video-player/player-math";
import { useLenis } from "@/components/smooth-scroll";
import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";

import { CreditLine } from "../../shell/credit";
import { useQueryState } from "../../use-query-state";
import { CanonMark } from "./caption";
import { fanFilter } from "./model";
import styles from "./video-strip.module.css";
import type { FanItem } from "./types";
import type { Facet } from "../core/types";

/** The ratio a video's card is drawn at. A broken size counts as 16 by 9. */
function ratioOf(item: FanItem): number {
  const w = item.video?.w ?? 0;
  const h = item.video?.h ?? 0;
  return w > 0 && h > 0 ? Math.min(2.4, Math.max(0.5, w / h)) : 16 / 9;
}

/**
 * One fan video: the site's player card (it grows into the player on a press and never starts by
 * itself), with its title, the label, the length and who made it under it.
 */
export function VideoEntry({ item, focused = false }: { item: FanItem; focused?: boolean }) {
  const video = item.video;
  if (!video) return null;
  const reel = item.canon !== "fan";
  return (
    <article
      className={styles.entry}
      data-video={item.id}
      data-focus={focused ? "true" : undefined}
      aria-label={item.title}
      style={{ ["--ar" as string]: ratioOf(item).toFixed(4) }}
    >
      <VideoCard
        video={{
          sources: [{ label: "Original", height: video.h, src: libUrl(video.src) }],
          poster: libUrl(video.poster),
          title: item.title,
        }}
        duration={video.dur}
        tag={reel ? "Official reel" : "Fan video"}
        className={styles.card}
      />
      <div className={styles.meta}>
        <h3 className={`${styles.title} display`} title={item.title}>
          {item.title}
        </h3>
        <p className={styles.marks}>
          <CanonMark item={item} />
          <span className="hud-label">{formatTime(video.dur)}</span>
        </p>
        <CreditLine credit={item.credit} canon={item.canon} />
        {item.canon !== "official" ? (
          <ReportLink item={{ id: item.id, title: item.title }} className={styles.report} />
        ) : null}
      </div>
    </article>
  );
}

function Arrow({ dir, onPress }: { dir: -1 | 1; onPress: () => void }) {
  return (
    <button
      type="button"
      className={styles.arrow}
      aria-label={dir < 0 ? "Earlier videos" : "Later videos"}
      onClick={onPress}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          d={dir < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    </button>
  );
}

/**
 * The videos of Fanart, as one row of their own over the picture rows. A video is not a still: it
 * opens the site's player, so its tile has the play mark and the player's cursor, not the zoom's.
 * The row follows the same search and filter as the pictures (the same functions), and the address
 * `?i=<id>` of a video brings it into view and marks it. Nothing starts by itself.
 */
export function VideoStrip({
  videos,
  facets,
}: {
  /** Every video of the room, in the order the row shows them. */
  videos: readonly FanItem[];
  /** The facets of the pictures: the filter the rows use, so a filter that names none of them is none. */
  facets: readonly Facet[];
}) {
  const [q] = useQueryState("q");
  const [f] = useQueryState("f");
  const [wanted] = useQueryState("i");
  const track = useRef<HTMLUListElement>(null);

  const shown = useMemo(() => fanFilter(videos, facets, q, f), [videos, facets, q, f]);
  const named = shown.some((v) => v.id === wanted) ? wanted : "";

  // The video the address names, marked once. A picture opened and closed afterwards takes the
  // address to its own id and back to this video: that changes nothing here. A cleared address
  // forgets the video, so the same link marks it again.
  const [marked, setMarked] = useState("");
  const next = wanted ? named || marked : "";
  if (next !== marked) setMarked(next);

  // A new marked video is brought into view: the row onto the screen, then the row sideways to the
  // card. The page stays where the visitor left it at any other time.
  const { getLenis } = useLenis();
  useEffect(() => {
    if (!marked) return;
    const strip = track.current;
    const el = strip?.querySelector<HTMLElement>(`[data-video="${CSS.escape(marked)}"]`);
    const li = el?.parentElement;
    if (!strip || !li) return;
    const r = strip.getBoundingClientRect();
    if (r.top < 90 || r.bottom > window.innerHeight) {
      const to = Math.max(0, r.top + window.scrollY - window.innerHeight * 0.3);
      const lenis = getLenis();
      if (lenis) lenis.scrollTo(to);
      else window.scrollTo({ top: to, behavior: "smooth" });
    }
    strip.scrollTo({
      left: Math.max(0, li.offsetLeft - strip.clientWidth / 2 + li.offsetWidth / 2),
      behavior: "smooth",
    });
  }, [marked, getLenis]);

  const step = (dir: 1 | -1) => {
    audio.blip("click");
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: "smooth" });
  };

  if (shown.length === 0) return null;
  const reels = shown.filter((v) => v.canon !== "fan").length;
  return (
    <section className={styles.strip} aria-label="Videos" data-fanart-videos={shown.length}>
      <div className={styles.head}>
        <h2 className={styles.heading}>Videos</h2>
        <p className={styles.count} aria-live="polite">
          {shown.length === videos.length
            ? `${shown.length} ${shown.length === 1 ? "video" : "videos"}`
            : `${shown.length} of ${videos.length} videos`}
          {reels > 0 ? `, ${reels} official ${reels === 1 ? "reel" : "reels"}` : ""}
        </p>
        <div className={styles.arrows}>
          <Arrow
            dir={-1}
            onPress={() => {
              step(-1);
            }}
          />
          <Arrow
            dir={1}
            onPress={() => {
              step(1);
            }}
          />
        </div>
      </div>
      <ul ref={track} className={styles.track}>
        {shown.map((video) => (
          <li key={video.id} className={styles.item}>
            <VideoEntry item={video} focused={video.id === marked} />
          </li>
        ))}
      </ul>
    </section>
  );
}
