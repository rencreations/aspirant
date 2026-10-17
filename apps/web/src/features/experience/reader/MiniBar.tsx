"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { useThemeAt } from "@/lib/hooks";

import { useExperience } from "../contract";
import { ContentsSheet } from "./ContentsSheet";
import { useReader } from "./reader-context";
import s from "./chrome.module.css";
import { SettingsPanel } from "./SettingsPanel";
import { getPartMeta, getUnit, unitIndex, unitLabel } from "./story-data";

/**
 * The slim bar under the site nav (it moves up when the nav hides): where you are, Resume,
 * Contents and reading settings, with a hairline for progress through the whole story.
 */
export function MiniBar() {
  const chapterId = useExperience((st) => st.chapterId);
  const partNumber = useExperience((st) => st.partNumber);
  const { resume, jumpTo } = useReader();
  const [navShown, setNavShown] = useState(true);
  const [visible, setVisible] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const theme = useThemeAt((w) => ({ x: w / 2, y: 96 }));

  useEffect(
    () =>
      useExperience.subscribe((st) => {
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

  const unit = chapterId ? getUnit(chapterId) : undefined;
  const part = partNumber ? getPartMeta(partNumber) : undefined;
  const saved = resume ? getUnit(resume.chapterId) : undefined;
  const showResume =
    resume !== null && saved !== undefined && resume.chapterId !== chapterId &&
    (chapterId === null || unitIndex(chapterId) < unitIndex(resume.chapterId));

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
          <span className={cn(s.wherePart, "hud-label")}>
            {part ? part.label : "Before you begin"}
          </span>
          {unit && (
            <span className={s.whereChapter}>
              <span className={s.whereLabel}>{unitLabel(unit)}</span>
              <span className={s.whereTitle}>{unit.title}</span>
            </span>
          )}
        </p>
        <div className={s.barActions}>
          {showResume && saved && (
            <button
              type="button"
              className={cn(s.barButton, s.barResume)}
              onClick={() => void jumpTo(resume.paragraphId ?? resume.chapterId)}
              aria-label={`Resume ${unitLabel(saved)}, ${saved.title}, where you left off`}
            >
              <span aria-hidden="true">Resume</span>
              <span className={s.barResumeAt} aria-hidden="true">
                {unitLabel(saved)}
              </span>
            </button>
          )}
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
