"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { actOf, chapterLabel, getChapter } from "@/content/story";

import { ContentsSheet } from "./ContentsSheet";
import s from "./chrome.module.css";
import { useReadingPosition } from "./position";
import { useReader } from "./reader-context";
import { SettingsPanel } from "./SettingsPanel";

/**
 * The slim bar under the site nav (it moves up when the nav hides): where you are, Contents and
 * the reading settings, with a hairline for progress through the whole story. It comes in once
 * the title card has scrolled away.
 */
export function MiniBar() {
  const { chapterId, theme } = useReader();
  const [navShown, setNavShown] = useState(true);
  const [visible, setVisible] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      useReadingPosition.subscribe((st) => {
        if (progressRef.current)
          progressRef.current.style.transform = `scaleX(${st.storyProgress.toFixed(4)})`;
      }),
    [],
  );

  useEffect(() => {
    const nav = document.querySelector('header[data-overlay="nav"]');
    if (!nav) return;
    const read = () => setNavShown(nav.getAttribute("data-hidden") !== "true");
    read();
    const mo = new MutationObserver(read);
    mo.observe(nav, { attributes: true, attributeFilter: ["data-hidden"] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      setVisible(window.scrollY > window.innerHeight * 0.6);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const entry = getChapter(chapterId);
  const act = entry ? actOf(entry) : undefined;

  return (
    <div
      className={s.minibar}
      data-minibar=""
      data-overlay="minibar"
      data-theme={theme}
      data-nav={navShown ? "shown" : "hidden"}
      data-visible={visible ? "true" : "false"}
      inert={!visible}
    >
      <div className={s.minibarInner}>
        <p className={s.where}>
          {act && <span className={cn(s.wherePart, "hud-label")}>{`Act ${act.roman}`}</span>}
          {entry && (
            <span className={s.whereChapter}>
              <span className={s.whereLabel}>{chapterLabel(entry)}</span>
              <span className={s.whereTitle}>{entry.number === 0 ? "" : entry.title}</span>
            </span>
          )}
        </p>
        <div className={s.barActions}>
          <ContentsSheet />
          <SettingsPanel />
        </div>
      </div>
      <div className={s.barProgress} aria-hidden="true">
        <div ref={progressRef} className={s.barProgressFill} />
      </div>
    </div>
  );
}
