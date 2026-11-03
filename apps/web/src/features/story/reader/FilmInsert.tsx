"use client";

import type { InsertBlock } from "@/content/story-types";
import { VideoCard } from "@/components/video-player/video-card";

import s from "./reader.module.css";

/**
 * A whole official film in the site's own player. It never starts by itself: the card is a poster
 * with a play button, and the player opens over the page.
 */
export function FilmInsert({ block }: { block: InsertBlock }) {
  if (!block.public || !block.poster || !block.title) return null;
  return (
    <figure className={s.film}>
      <VideoCard
        className={s.filmCard}
        tag="Film"
        {...(block.duration ? { duration: block.duration } : {})}
        video={{
          sources: [
            {
              label: `${block.height ?? 720}p`,
              height: block.height ?? 720,
              src: `/${block.public}`,
            },
          ],
          poster: `/${block.poster}`,
          title: block.title,
        }}
      />
      {block.caption && (
        <figcaption className={s.credit}>
          <span className={s.creditCaption}>{block.caption}</span>
          <span className={s.creditSource}>Official film, plays with sound</span>
        </figcaption>
      )}
    </figure>
  );
}
