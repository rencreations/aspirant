"use client";

import { useCallback, useEffect, useRef } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { useFreshStart } from "@/features/character/vexana/seams/fresh-start";
import { BareScrollbar } from "@/features/character/vexana/shared/bare-scrollbar";
import { REVEAL_EVENT } from "@/lib/hooks";
import { useNavLock } from "@/lib/nav-lock";

import { Brief } from "./brief";
import { CanonComics } from "./canon-comics";
import { Characters } from "./characters";
import { ChapterSelect } from "./chapters";
import { DramaSection } from "./drama-section";
import { layoutTop, StoryHero } from "./hero";
import styles from "./loop.module.css";
import { LoreTeaser } from "./lore-teaser";
import { useStoryProgress } from "./progress";
import { StoryRise } from "./rise";

/** Within this many pixels of the end of the page, the page starts over. */
const WRAP_PX = 3;

/**
 * /story: the page that promotes the story, and a page with no end. A film and the title fill the
 * first screen; the first thing the visitor does is Continue (when a place is saved) or Start
 * reading, or pick a chapter. Scrolling brings the rest of the page up from below over the hero: a
 * short description of the story, the chapter selection with the place the visitor stopped pinned
 * on top, and the ten Aspirants.
 *
 * The hero is ONE fixed layer behind the page, so the page is: a screen with nothing on it (the
 * hero shows), the white page, and another screen with nothing on it. At the end the white page
 * leaves the way it came (`rise.tsx` plays the rise backwards) and the hero is back exactly as it
 * was at the top, with its film and its buttons live. Then the scroll is put back to the top in
 * the same frame, where the very same picture is on screen, and the visitor can go on for ever.
 * The browser's scrollbar is hidden. The story itself is read one chapter to a page.
 */
export function StoryLanding() {
  const progress = useStoryProgress();
  const heroProgress = useRef<(p: number) => void>(() => undefined);
  useFreshStart();
  const { scrollTo, getLenis } = useLenis();

  // "All chapters" at the end of a chapter comes here with #chapters: land on the list. A page
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

  // The top bar is bare over the hero and takes the page's colour over the panel: it is told when
  // the panel reaches the top of the screen and when it leaves it, at both ends of the page, so the
  // end looks exactly like the start.
  const covering = useRef(false);
  const theme = progress.theme;
  const setBar = useCallback(() => {
    useNavLock.setState(covering.current ? { theme, bare: false } : { theme: "storm", bare: true });
  }, [theme]);
  useEffect(() => {
    setBar();
  }, [setBar]);
  useEffect(
    () => () => {
      useNavLock.setState({ theme: null, bare: false });
    },
    [],
  );

  // The end of the page is the start of it: when the scroll gets to the very end, it goes back to the
  // top in the same frame. The picture on screen at the end (the hero, the page gone) and at the
  // top (the hero, the page one screen down) is the same one, so nothing can be seen.
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const down = y > last;
      last = y;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      // Not before the page is laid out (it is several screens tall once it is).
      if (!down || max < window.innerHeight * 3 || y < max - WRAP_PX) return;
      const lenis = getLenis();
      if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
      else window.scrollTo(0, 0);
      last = 0;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [getLenis]);

  return (
    <div className={styles.loop}>
      <BareScrollbar />
      <div className={styles.heroLayer}>
        <StoryHero progress={progress} progressRef={heroProgress} />
      </div>
      <div className={styles.gap} aria-hidden="true" />
      <StoryRise
        id="story-rise"
        theme={progress.theme}
        onProgress={(p) => heroProgress.current(p)}
        onOver={(over) => {
          covering.current = over;
          setBar();
        }}
      >
        <Brief />
        <ChapterSelect progress={progress} />
        <Characters />
        <DramaSection />
        <CanonComics />
        <LoreTeaser />
      </StoryRise>
      <div className={styles.gap} aria-hidden="true" />
    </div>
  );
}
