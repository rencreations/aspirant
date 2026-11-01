"use client";

import { useRef, useState } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { useLenis } from "@/components/smooth-scroll";
import { TLink } from "@/components/transition/t-link";
import { StarButton } from "@/components/ui/star-button";
import { chapters } from "@/content/story";
import { audio } from "@/lib/audio";

import { storyChapterHref } from "../chapter-href";
import { getPartMeta, unitLabel } from "../reader/story-data";
import { orderUnits, readingMinutes, visibleUnits, type ChapterOrder } from "./chapter-list";
import { layoutTop } from "./hero";
import s from "./landing.module.css";
import type { StoryProgress } from "./progress";

const ORDERS: ReadonlyArray<{ value: ChapterOrder; label: string }> = [
  { value: "first", label: "From Chapter 1" },
  { value: "latest", label: "Latest first" },
];

/**
 * The chapter selection. The place the visitor stopped is pinned on top, with Continue. Below it
 * the chapters, from Chapter 1 or from the latest one, folded to a few rows with a fade and a
 * "Show all" button until the visitor opens the whole list. Every row opens its chapter on the page
 * of its Part.
 */
export function ChapterSelect({ progress }: { progress: StoryProgress }) {
  const [order, setOrder] = useState<ChapterOrder>("first");
  const [expanded, setExpanded] = useState(false);
  const section = useRef<HTMLElement>(null);
  const { scrollTo } = useLenis();

  const all = orderUnits(chapters, order);
  const rows = visibleUnits(all, expanded);
  const folded = rows.length < all.length;
  const saved = progress.resume ? chapters.find((c) => c.id === progress.resume?.chapterId) : null;
  const savedPart = saved ? getPartMeta(saved.part) : null;

  const fold = () => {
    setExpanded(false);
    const el = section.current;
    if (el) requestAnimationFrame(() => scrollTo(layoutTop(el) - 88, { duration: 0.8 }));
  };

  return (
    <section ref={section} id="chapters" className={s.chapters} aria-labelledby="chapters-title">
      <div className={s.wrap}>
        <p className={s.kicker}>Chapters</p>
        <h2 id="chapters-title" className={s.heading}>
          Choose a chapter
        </h2>

        {progress.resume && saved && (
          <div className={s.pinned}>
            <p className={s.pinnedKicker}>Continue</p>
            <p className={s.pinnedTitle}>
              <span className={s.pinnedLabel}>{unitLabel(saved)}</span>
              {saved.title}
            </p>
            <p className={s.pinnedMeta}>
              {savedPart ? `${savedPart.label}: ${savedPart.title}` : null}
            </p>
            <StarButton
              pulse
              href={progress.resume.href}
              transitionLabel={unitLabel(saved)}
              aria-label={`Continue ${unitLabel(saved)}, ${saved.title}`}
            >
              Continue reading
            </StarButton>
          </div>
        )}

        <div className={s.listHead}>
          <p className={s.listTitle}>All chapters</p>
          <div className={s.order} role="group" aria-label="Order of the chapters">
            {ORDERS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={s.orderButton}
                aria-pressed={order === option.value}
                onClick={() => {
                  if (order === option.value) return;
                  setOrder(option.value);
                  audio.blip("click");
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className={cn(s.listWrap, folded && s.folded)}>
          <ol className={s.list}>
            {rows.map((unit) => {
              const part = getPartMeta(unit.part);
              const interlude = unit.number === null;
              return (
                <li key={unit.id} className={s.row}>
                  <TLink
                    href={storyChapterHref(unit.id)}
                    transitionLabel={unitLabel(unit)}
                    className={s.rowLink}
                    aria-label={`${unitLabel(unit)}: ${unit.title}`}
                    data-current={progress.resume?.chapterId === unit.id ? "true" : undefined}
                  >
                    <span className={s.rowNum} aria-hidden="true">
                      {interlude ? "IN" : String(unit.number).padStart(2, "0")}
                    </span>
                    <span className={s.rowText}>
                      <span className={s.rowTitle} aria-hidden="true">
                        {unit.title}
                      </span>
                      <span className={s.rowMeta} aria-hidden="true">
                        {part?.label}
                        {interlude ? " / Interlude" : ""} / {readingMinutes(unit.wordCount)} min
                      </span>
                    </span>
                    <span className={s.rowArrow} aria-hidden="true">
                      &rarr;
                    </span>
                  </TLink>
                </li>
              );
            })}
          </ol>
          {folded && <div className={s.fade} aria-hidden="true" />}
        </div>

        <div className={s.more}>
          {folded ? (
            <StarButton
              variant="ghost"
              arrow={false}
              onClick={() => setExpanded(true)}
              aria-label={`Show all ${all.length} chapters`}
            >
              Show all chapters
            </StarButton>
          ) : expanded ? (
            <StarButton variant="ghost" arrow={false} onClick={fold}>
              Show fewer
            </StarButton>
          ) : null}
        </div>
      </div>
    </section>
  );
}
