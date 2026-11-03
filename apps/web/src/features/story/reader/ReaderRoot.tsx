"use client";

/**
 * The reader's client shell around the server-rendered chapter: the theme (light or dark, the
 * visitor's choice, one for the whole story), the text size, the reading engine, the music under
 * the chapter, the chrome (mini-bar, contents, settings) and `jumpTo`, which moves to a paragraph
 * of this page.
 */
import { useCallback, useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { NAVIGATED_EVENT, REVEAL_EVENT, useIsoLayoutEffect } from "@/lib/hooks";

import { READING_LINE, useReadingEngine } from "./engine";
import { MiniBar } from "./MiniBar";
import { loadReaderPrefs, useReaderPrefs, writePrefs, type ReaderTheme } from "./prefs";
import { ReaderContext, type JumpOptions, type ReaderApi } from "./reader-context";
import s from "./reader.module.css";
import { releaseScore, startScore } from "./score";

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Ids the address may name: a paragraph of this chapter (`c05-p012`). */
const PARAGRAPH = /^c\d{2}-p\d{3}$/u;

function chromeHeight(): number {
  const nav = document.querySelector<HTMLElement>('header[data-overlay="nav"]')?.offsetHeight ?? 56;
  const bar = document.querySelector<HTMLElement>("[data-minibar]")?.offsetHeight ?? 44;
  return nav + bar + 12;
}

export function ReaderRoot({
  chapterId,
  score,
  children,
}: {
  chapterId: string;
  score: string | null;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { scrollTo } = useLenis();
  const textScale = useReaderPrefs((st) => st.textScale);
  const theme = useReaderPrefs((st) => st.theme);

  useReadingEngine(rootRef, chapterId);

  const jumpTo = useCallback(
    async (id: string, { smooth = false, focus = true }: JumpOptions = {}) => {
      await nextFrame();
      const el = document.getElementById(id);
      if (!el) return;
      const isParagraph = el.hasAttribute("data-p");
      const offset = isParagraph
        ? -Math.round(window.innerHeight * READING_LINE) + 6
        : -chromeHeight();
      const distance = Math.abs(el.getBoundingClientRect().top + offset);
      if (smooth && distance < window.innerHeight * 3) {
        scrollTo(el, { offset, duration: Math.min(1.6, 0.6 + distance / 4000) });
      } else {
        scrollTo(el, { offset, immediate: true });
      }
      if (focus) el.querySelector<HTMLElement>("h1[tabindex]")?.focus({ preventScroll: true });
    },
    [scrollTo],
  );

  const setTextScale = useCallback((value: number) => {
    useReaderPrefs.setState({ textScale: value });
    writePrefs({ textScale: value });
  }, []);

  const setTheme = useCallback((value: ReaderTheme) => {
    useReaderPrefs.setState({ theme: value });
    writePrefs({ theme: value });
  }, []);

  // Saved preferences before the first paint after hydration, so a dark reader never shows light.
  useIsoLayoutEffect(() => {
    loadReaderPrefs();
  }, []);

  // The bar at the top and the rest of the fixed chrome follow the world under them: tell them
  // the theme has changed once it is on the page.
  useEffect(() => {
    window.dispatchEvent(new Event(NAVIGATED_EVENT));
  }, [theme]);

  // The music under this chapter, and its release when the story is left.
  useEffect(() => {
    startScore(score);
    return releaseScore;
  }, [score]);

  // Deep links (#c05-p012) land with the paragraph under the reading line.
  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (PARAGRAPH.test(id)) void jumpTo(id, { focus: false });
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    // A page transition has just put the scroll back at the top: go to the place again.
    window.addEventListener(REVEAL_EVENT, fromHash);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      window.removeEventListener(REVEAL_EVENT, fromHash);
    };
  }, [jumpTo]);

  const api = useMemo<ReaderApi>(
    () => ({ chapterId, jumpTo, textScale, setTextScale, theme, setTheme }),
    [chapterId, jumpTo, textScale, setTextScale, theme, setTheme],
  );

  return (
    <ReaderContext.Provider value={api}>
      <div
        ref={rootRef}
        className={s.reader}
        data-theme={theme}
        style={{ "--rd-scale": textScale } as CSSProperties}
      >
        {children}
      </div>
      <MiniBar />
    </ReaderContext.Provider>
  );
}
