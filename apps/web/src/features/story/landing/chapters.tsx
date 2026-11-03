"use client";

import { useRef, useState, type CSSProperties } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { useLenis } from "@/components/smooth-scroll";
import { TLink } from "@/components/transition/t-link";
import { StarButton } from "@/components/ui/star-button";
import { acts, chapterLabel, chapters, getChapter } from "@/content/story";
import { asset } from "@/lib/asset";

import { chapterHref } from "../chapter-href";
import { isRevealed } from "../reader/prefs";
import { countCards, groupByAct, visibleGroups } from "./chapter-list";
import { layoutTop } from "./hero";
import s from "./landing.module.css";
import p from "./preview.module.css";
import type { StoryProgress } from "./progress";

const GROUPS = groupByAct(acts, chapters);

/**
 * The chapter preview: every chapter as a card with its picture, number, title, the time and
 * place line and the reading time, grouped under the six acts. The place the visitor stopped is
 * pinned on top with Continue. A chapter whose picture would give something away shows a sealed
 * (blurred, dark) picture until the visitor has reached it. The list is folded to a few cards
 * with a fade and a "Show all" button until the visitor opens the whole of it.
 */
export function ChapterSelect({ progress }: { progress: StoryProgress }) {
  const [expanded, setExpanded] = useState(false);
  const section = useRef<HTMLElement>(null);
  const { scrollTo } = useLenis();

  const shown = visibleGroups(GROUPS, expanded);
  const total = chapters.length;
  const folded = countCards(shown) < total;
  const saved = progress.resume ? getChapter(progress.resume.chapterId) : undefined;

  const fold = () => {
    setExpanded(false);
    const el = section.current;
    if (el) requestAnimationFrame(() => scrollTo(layoutTop(el) - 88, { duration: 0.8 }));
  };

  return (
    <section ref={section} id="chapters" className={s.chapters} aria-labelledby="chapters-title">
      <div className={p.wide}>
        <p className={s.kicker}>Chapters</p>
        <h2 id="chapters-title" className={s.heading}>
          Choose a chapter
        </h2>

        {progress.resume && saved && (
          <div className={s.pinned}>
            <p className={s.pinnedKicker}>Continue</p>
            <p className={s.pinnedTitle}>
              <span className={s.pinnedLabel}>{chapterLabel(saved)}</span>
              {saved.number === 0 ? "Prologue" : saved.title}
            </p>
            <p className={s.pinnedMeta}>{saved.dateline ?? ""}</p>
            <StarButton
              pulse
              href={progress.resume.href}
              transitionLabel={chapterLabel(saved)}
              aria-label={`Continue ${chapterLabel(saved)}${saved.number === 0 ? "" : `, ${saved.title}`}`}
            >
              Continue reading
            </StarButton>
          </div>
        )}

        <div className={cn(p.listWrap, folded && p.folded)}>
          {shown.map((group) => (
            <section key={group.act.roman} className={p.act} aria-label={`Act ${group.act.roman}`}>
              <h3 className={p.actHead}>
                <span className={p.actRoman}>{`Act ${group.act.roman}`}</span>
                <span className={p.actTitle}>{group.act.title}</span>
              </h3>
              <ol className={p.grid}>
                {group.chapters.map((c) => {
                  const open = isRevealed(c.number, progress.furthest);
                  const sealed = c.sealed !== null && !open;
                  return (
                    <li key={c.id} className={p.cardItem}>
                      <TLink
                        href={chapterHref(c.id)}
                        transitionLabel={chapterLabel(c)}
                        className={p.card}
                        aria-label={`${chapterLabel(c)}${c.number === 0 ? "" : `: ${c.title}`}`}
                        data-current={progress.resume?.chapterId === c.id ? "true" : undefined}
                        style={{ "--tint": c.color } as CSSProperties}
                      >
                        <span className={p.picture}>
                          {/* Plain <img>: static export, art already sized. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={asset(`/${sealed && c.sealed ? c.sealed : c.thumb}`)}
                            alt=""
                            width={640}
                            height={360}
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                          />
                          <span className={p.number} aria-hidden="true">
                            {c.number === 0 ? "PR" : String(c.number).padStart(2, "0")}
                          </span>
                          {sealed && (
                            <span className={p.sealed} aria-hidden="true">
                              Sealed
                            </span>
                          )}
                        </span>
                        <span className={p.info}>
                          <span className={p.title} aria-hidden="true">
                            {c.number === 0 ? "Prologue" : c.title}
                          </span>
                          {c.dateline && (
                            <span className={p.dateline} aria-hidden="true">
                              {c.dateline}
                            </span>
                          )}
                          {c.mood && (
                            <span className={p.mood} aria-hidden="true">
                              {c.mood}
                            </span>
                          )}
                          <span className={p.meta} aria-hidden="true">
                            {c.minutes} min read
                          </span>
                        </span>
                      </TLink>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {folded && <div className={p.fade} aria-hidden="true" />}
        </div>

        <div className={s.more}>
          {folded ? (
            <StarButton
              variant="ghost"
              arrow={false}
              onClick={() => setExpanded(true)}
              aria-label={`Show all ${total} chapters`}
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
