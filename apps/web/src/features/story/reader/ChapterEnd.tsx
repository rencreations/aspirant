/**
 * The way on at the end of a chapter: a card for the next chapter with its picture, the one
 * before, and the list. After the last chapter the card leads to the end page. A chapter whose
 * picture would give something away shows its sealed twin here.
 */
import type { Route } from "next";
import type { CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";
import { chapterLabel, nextChapter, previousChapter } from "@/content/story";
import type { ChapterEntry } from "@/content/story-types";
import { asset } from "@/lib/asset";
import { routes } from "@/lib/site";

import { chapterHref, END_HREF } from "../chapter-href";
import s from "./reader.module.css";

export function ChapterEnd({ entry }: { entry: ChapterEntry }) {
  const next = nextChapter(entry.id);
  const previous = previousChapter(entry.id);
  return (
    <nav className={s.end} aria-label="Chapters">
      {next ? (
        <TLink
          href={chapterHref(next.id)}
          transitionLabel={chapterLabel(next)}
          className={s.endNext}
          style={{ "--tint": next.color } as CSSProperties}
          data-cursor="NEXT"
        >
          {/* Plain <img>: static export. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={s.endPicture}
            src={asset(`/${next.sealed ?? next.thumb}`)}
            alt=""
            width={640}
            height={360}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
          <span className={s.endShade} aria-hidden="true" />
          <span className={s.endText}>
            <span className={s.endKicker}>Next</span>
            <span className={s.endLabel}>{chapterLabel(next)}</span>
            <span className={s.endTitle}>{next.title}</span>
            {next.dateline && <span className={s.endDate}>{next.dateline}</span>}
          </span>
        </TLink>
      ) : (
        <TLink
          href={END_HREF}
          transitionLabel="The end"
          className={s.endNext}
          style={{ "--tint": entry.color } as CSSProperties}
          data-cursor="NEXT"
        >
          <span className={s.endShade} aria-hidden="true" />
          <span className={s.endText}>
            <span className={s.endKicker}>The story stops here</span>
            <span className={s.endLabel}>After the last page</span>
            <span className={s.endTitle}>Who is who, and when it happened</span>
          </span>
        </TLink>
      )}
      <div className={s.endRow}>
        {previous ? (
          <TLink
            href={chapterHref(previous.id)}
            transitionLabel={chapterLabel(previous)}
            className={s.endLink}
          >
            {`Before: ${previous.number === 0 ? "Prologue" : previous.title}`}
          </TLink>
        ) : (
          <span />
        )}
        <TLink
          href={`${routes.story}/#chapters` as Route}
          transitionLabel="Story"
          className={s.endLink}
        >
          All chapters
        </TLink>
      </div>
    </nav>
  );
}
