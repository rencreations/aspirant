"use client";

import { Dialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { useLenis } from "@/components/smooth-scroll";
import { audio } from "@/lib/audio";

import { useExperience } from "../contract";
import s from "./chrome.module.css";
import { useReader } from "./reader-context";
import { getUnit, PARTS, unitShort } from "./story-data";

/**
 * The table of contents: a bottom sheet on phones and a side panel on larger screens, with one
 * accordion per Part (the current Part open). Choosing a chapter closes the sheet, loads its
 * Part and moves there; focus lands on the chapter heading.
 */
export function ContentsSheet() {
  const [open, setOpen] = useState(false);
  const partNumber = useExperience((st) => st.partNumber);
  const chapterId = useExperience((st) => st.chapterId);
  const { jumpTo } = useReader();
  const { pause, resume } = useLenis();
  const jumped = useRef(false);

  useEffect(() => {
    if (!open) return;
    pause();
    return resume;
  }, [open, pause, resume]);

  const go = (id: string) => {
    jumped.current = true;
    setOpen(false);
    audio.blip("confirm");
    void jumpTo(id);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        jumped.current = false;
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
          data-theme="storm"
          data-lenis-prevent=""
          onCloseAutoFocus={(e) => {
            if (jumped.current) e.preventDefault();
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
            Twelve Parts. Open a Part and choose a chapter to go there.
          </Dialog.Description>
          <ol className={s.sheetParts}>
            {PARTS.map((part) => (
              <li key={part.number}>
                <details className={s.sheetPart} open={part.number === (partNumber ?? 1) || undefined}>
                  <summary className={s.sheetSummary}>
                    <span className={s.sheetNum} aria-hidden="true">
                      {String(part.number).padStart(2, "0")}
                    </span>
                    <span className={s.sheetPartText}>
                      <span className="hud-label">{part.label}</span>
                      <span className={s.sheetPartTitle}>{part.title}</span>
                    </span>
                  </summary>
                  <ol className={s.sheetChapters}>
                    {part.chapterIds.map((id) => {
                      const unit = getUnit(id);
                      if (!unit) return null;
                      const label = unit.number === null ? "Interlude" : `Chapter ${unit.number}`;
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            className={s.sheetChapter}
                            aria-current={id === chapterId ? "location" : undefined}
                            onClick={() => go(id)}
                          >
                            <span className={s.sheetChapterNum} aria-hidden="true">
                              {unitShort(unit)}
                            </span>
                            <span>
                              <span className="sr-only">{label}: </span>
                              {unit.title}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </details>
              </li>
            ))}
          </ol>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
