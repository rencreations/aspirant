"use client";

import { useEffect, useRef } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { NextFooter } from "@/components/next-footer/next-footer";
import { Hold } from "@/features/character/vexana/seams/hold";
import { useFreshStart } from "@/features/character/vexana/seams/fresh-start";
import { REVEAL_EVENT } from "@/lib/hooks";
import { routes } from "@/lib/site";

import { Brief } from "./brief";
import { Characters } from "./characters";
import { ChapterSelect } from "./chapters";
import { layoutTop, StoryHero } from "./hero";
import { useStoryProgress } from "./progress";
import { StoryRise } from "./rise";

/** The screens the hero is held for while the page rises over it. */
const HOLD_SCREENS = 1;

/**
 * /story: the page that promotes the story. A film and the title fill the first screen; the first
 * thing the visitor does is Continue (when a place is saved) or Start reading, or pick a chapter.
 * Scrolling brings the rest of the page up from below over the held hero (the join of Vexana's
 * pair to her interlude, with a plain page in place of the film): a short description of the
 * story, the chapter selection with the place the visitor stopped pinned on top, and the ten
 * Aspirants. The story itself is read one Part to a page (`/story/part-01/` and on).
 */
export function StoryLanding() {
  const progress = useStoryProgress();
  const heroProgress = useRef<(p: number) => void>(() => undefined);
  useFreshStart();
  const { scrollTo } = useLenis();

  // "All chapters" at the end of a Part comes here with #chapters: land on the list. A page
  // transition puts the scroll back at the top just before it opens, so it is done again then.
  useEffect(() => {
    const toList = () => {
      if (window.location.hash !== "#chapters") return;
      const el = document.getElementById("chapters");
      if (el) scrollTo(layoutTop(el) - 88, { immediate: true });
    };
    toList();
    window.addEventListener(REVEAL_EVENT, toList);
    return () => window.removeEventListener(REVEAL_EVENT, toList);
  }, [scrollTo]);

  return (
    <>
      <Hold hold={HOLD_SCREENS}>
        <StoryHero progress={progress} progressRef={heroProgress} />
      </Hold>
      <StoryRise id="story-rise" theme={progress.theme} onProgress={(p) => heroProgress.current(p)}>
        <Brief />
        <ChapterSelect progress={progress} />
        <Characters />
      </StoryRise>
      <NextFooter
        eyebrow="Next"
        label="The ten"
        sublabel="Meet the ten Aspirants, starting with Fanny."
        href={routes.characters}
        image="/img/char/fanny/splash.webp"
      />
    </>
  );
}
