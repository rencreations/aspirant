/**
 * The opening of a chapter: a full-screen picture (a still or a muted loop) under a shade, the
 * act and chapter number, the title, the time and place line and a cue to scroll. The text is in
 * the page's HTML; only the picture is a client island. The picture and the text drift as the card
 * scrolls away (CSS scroll-driven animation, transform and opacity only).
 */
import type { CSSProperties } from "react";

import { actOf, chapterLabel } from "@/content/story";
import type { Chapter, ChapterEntry } from "@/content/story-types";

import { HeroMedia } from "./HeroMedia";
import s from "./reader.module.css";

export function TitleCard({ chapter, entry }: { chapter: Chapter; entry: ChapterEntry }) {
  const act = actOf(entry);
  const label = chapterLabel(entry);
  return (
    <header
      className={s.card}
      data-card=""
      style={{ "--tint": chapter.hero.color } as CSSProperties}
    >
      <div className={s.cardPicture}>
        <HeroMedia media={chapter.hero} focus={chapter.heroFocus} />
      </div>
      <div className={s.cardShade} aria-hidden="true" />
      <div className={s.cardText}>
        <p className={s.cardKicker}>
          {act && <span>{`Act ${act.roman}, ${act.title}`}</span>}
          <span aria-hidden="true">/</span>
          <span>{label}</span>
        </p>
        <h1 id={`${chapter.id}-title`} className={s.cardTitle} tabIndex={-1}>
          {entry.number > 0 && <span className="sr-only">{label}: </span>}
          {chapter.title}
        </h1>
        {chapter.dateline && <p className={s.cardDateline}>{chapter.dateline}</p>}
        {chapter.mood && <p className={s.cardMood}>{chapter.mood}</p>}
      </div>
      <p className={s.cardCue} aria-hidden="true">
        <span>Scroll</span>
      </p>
    </header>
  );
}
