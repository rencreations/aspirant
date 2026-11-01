"use client";

/**
 * The reader's client shell around the server-rendered Part: one theme for the whole story (light
 * or dark, the visitor's choice), the text size, the reading engine, the shared entity card, the
 * chrome (mini-bar, contents, settings) and `jumpTo`, which moves to a chapter or a paragraph of
 * this page. The page behind the text is one plain colour.
 */
import { useCallback, useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { NAVIGATED_EVENT, REVEAL_EVENT, useIsoLayoutEffect } from "@/lib/hooks";

import { READING_LINE, useReadingEngine } from "./engine";
import { EntityCards } from "./EntityCards";
import { MiniBar } from "./MiniBar";
import { loadReaderPrefs, useReaderPrefs, writePrefs, type ReaderTheme } from "./prefs";
import { ReaderContext, type JumpOptions, type ReaderApi } from "./reader-context";
import s from "./reader.module.css";

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Ids the address may name: a chapter, a paragraph, or the end. */
const ID = /^(?:c\d{2}|i-far-above-\d)(?:-p\d{3})?$|^the-end$/u;

function chromeHeight(): number {
  const nav = document.querySelector<HTMLElement>('header[data-overlay="nav"]')?.offsetHeight ?? 56;
  const bar = document.querySelector<HTMLElement>("[data-minibar]")?.offsetHeight ?? 44;
  return nav + bar + 12;
}

export function ReaderRoot({ part, children }: { part: number; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { scrollTo } = useLenis();
  const textScale = useReaderPrefs((st) => st.textScale);
  const theme = useReaderPrefs((st) => st.theme);

  useReadingEngine(rootRef);

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
      if (focus) el.querySelector<HTMLElement>("h2[tabindex]")?.focus({ preventScroll: true });
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

  // The bar at the top and the rest of the fixed chrome follow the world under them: tell them the
  // theme has changed once it is on the page.
  useEffect(() => {
    window.dispatchEvent(new Event(NAVIGATED_EVENT));
  }, [theme]);

  // Deep links (#c30, #c30-p012, #the-end) land with the text under the reading line.
  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (ID.test(id)) void jumpTo(id, { focus: false });
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
    () => ({ part, jumpTo, textScale, setTextScale, theme, setTheme }),
    [part, jumpTo, textScale, setTextScale, theme, setTheme],
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
        <EntityCards rootRef={rootRef} />
      </div>
      <MiniBar />
    </ReaderContext.Provider>
  );
}
