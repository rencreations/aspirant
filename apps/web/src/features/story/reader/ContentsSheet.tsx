"use client";

import { Dialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { TLink } from "@/components/transition/t-link";
import { useLenis } from "@/components/smooth-scroll";
import { characters } from "@/content/characters";
import { acts, chapterLabel, chaptersOfAct, getChapter } from "@/content/story";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";

import { chapterHref } from "../chapter-href";
import s from "./chrome.module.css";
import { FIRST_CHAPTER, PORTRAIT_LINES } from "./portrait-copy";
import { portraitFor } from "./portraits";
import { isRevealed, useReaderPrefs } from "./prefs";
import { useReader } from "./reader-context";

/**
 * The table of contents: a bottom sheet on phones and a side panel on larger screens, with one
 * accordion per act (the act of this page open) and a small picture for each chapter. The chapter
 * of this page is reached by scrolling to its top; any other opens its own page.
 */
export function ContentsSheet() {
  const [open, setOpen] = useState(false);
  const { chapterId, theme } = useReader();
  const { pause, resume, scrollTo } = useLenis();
  const stay = useRef(false);
  const here = getChapter(chapterId);
  const furthest = useReaderPrefs((st) => st.furthest);
  const reached = Math.max(furthest, here?.number ?? -1);

  useEffect(() => {
    if (!open) return;
    pause();
    return resume;
  }, [open, pause, resume]);

  const toTop = () => {
    stay.current = true;
    setOpen(false);
    audio.blip("confirm");
    scrollTo(0, { immediate: false });
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        stay.current = false;
        setOpen(next);
        audio.blip(next ? "click" : "hover");
      }}
    >
      <Dialog.Trigger className={s.barButton} data-contents="">
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M2 3.5h12M2 8h12M2 12.5h8" stroke="currentColor" strokeWidth="1.4" fill="none" />
        </svg>
        <span>Contents</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={s.sheetOverlay} />
        <Dialog.Content
          className={s.sheet}
          data-theme={theme}
          data-lenis-prevent=""
          onCloseAutoFocus={(e) => {
            if (stay.current) e.preventDefault();
          }}
        >
          <div className={s.sheetHead}>
            <Dialog.Title className={cn(s.sheetTitle, "hud-label")}>Contents</Dialog.Title>
            <Dialog.Close className={s.sheetClose} aria-label="Close contents">
              <span aria-hidden="true">Close</span>
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Six acts. Open an act and choose a chapter to go there.
          </Dialog.Description>
          <ol className={s.sheetParts}>
            {acts.map((act) => (
              <li key={act.roman}>
                <details className={s.sheetPart} open={here?.act === act.roman || undefined}>
                  <summary className={s.sheetSummary}>
                    <span className={s.sheetNum} aria-hidden="true">
                      {act.roman}
                    </span>
                    <span className={s.sheetPartText}>
                      <span className="hud-label">{`Act ${act.roman}`}</span>
                      <span className={s.sheetPartTitle}>{act.title}</span>
                    </span>
                  </summary>
                  <ol className={s.sheetChapters}>
                    {chaptersOfAct(act).map((c) => {
                      const inner = (
                        <>
                          {/* Plain <img>: static export. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            className={s.sheetThumb}
                            src={asset(
                              `/${c.sealed && !isRevealed(c.number, reached) ? c.sealed : c.thumb}`,
                            )}
                            alt=""
                            width={64}
                            height={36}
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                          />
                          <span className={s.sheetChapterNum} aria-hidden="true">
                            {c.number === 0 ? "PR" : String(c.number).padStart(2, "0")}
                          </span>
                          <span>
                            <span className="sr-only">{chapterLabel(c)}: </span>
                            {c.number === 0 ? "Prologue" : c.title}
                          </span>
                        </>
                      );
                      return (
                        <li key={c.id}>
                          {c.id === chapterId ? (
                            <button
                              type="button"
                              className={s.sheetChapter}
                              aria-current="location"
                              onClick={toTop}
                            >
                              {inner}
                            </button>
                          ) : (
                            <TLink
                              href={chapterHref(c.id)}
                              transitionLabel={chapterLabel(c)}
                              className={s.sheetChapter}
                            >
                              {inner}
                            </TLink>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </details>
              </li>
            ))}
          </ol>
          <section className={s.sheetCast} aria-labelledby="sheet-cast-title">
            <h2 id="sheet-cast-title" className={cn(s.sheetCastTitle, "hud-label")}>
              People so far
            </h2>
            <ul className={s.sheetCastList}>
              {FIRST_CHAPTER.filter(([, first]) => first <= reached).map(([slug]) => {
                const person = characters.find((c) => c.slug === slug);
                const face = portraitFor(slug);
                if (!person) return null;
                return (
                  <li key={slug} className={s.sheetCastItem}>
                    {face && (
                      <>
                        {/* Plain <img>: static export. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          className={s.sheetCastFace}
                          src={asset(face.src)}
                          alt=""
                          width={40}
                          height={40}
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                          style={{ objectPosition: face.position }}
                        />
                      </>
                    )}
                    <span className={s.sheetCastText}>
                      <span className={s.sheetCastName}>{person.name}</span>
                      <span className={s.sheetCastLine}>{PORTRAIT_LINES[slug]}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
