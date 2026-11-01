"use client";

import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { audio } from "@/lib/audio";

import s from "./chrome.module.css";
import type { ReaderTheme } from "./prefs";
import { TEXT_SCALES } from "./prefs";
import { useReader } from "./reader-context";

const THEMES: ReadonlyArray<{ value: ReaderTheme; label: string }> = [
  { value: "daybreak", label: "Light" },
  { value: "storm", label: "Dark" },
];

/**
 * Reading settings in a small disclosure panel: text size and the theme (light or dark, one for
 * the whole story). Esc or a press outside closes it. No focus trap. The sound has no switch here:
 * the one in the bar at the top of the site is the only one.
 */
export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const { textScale, setTextScale, theme, setTheme } = useReader();
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const step = TEXT_SCALES.indexOf(textScale as (typeof TEXT_SCALES)[number]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const size = (delta: number) => {
    const next = TEXT_SCALES[Math.min(TEXT_SCALES.length - 1, Math.max(0, step + delta))];
    if (next !== undefined && next !== textScale) {
      setTextScale(next);
      audio.blip("click");
    }
  };

  return (
    <div ref={wrapRef} className={s.settings}>
      <button
        ref={buttonRef}
        type="button"
        className={s.barButton}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((v) => !v);
          audio.blip("click");
        }}
      >
        <span className={s.aa} aria-hidden="true">
          Aa
        </span>
        <span>Settings</span>
      </button>
      <div
        id={panelId}
        className={s.settingsPanel}
        hidden={!open}
        role="group"
        aria-label="Reading settings"
      >
        <p className={cn(s.settingsTitle, "hud-label")}>Reading settings</p>
        <div className={s.sizeRow}>
          <span className={s.settingLabel}>Text size</span>
          <div className={s.sizeControls}>
            <button
              type="button"
              className={s.sizeButton}
              onClick={() => size(-1)}
              disabled={step <= 0}
              aria-label="Smaller text"
            >
              A<span aria-hidden="true">&minus;</span>
            </button>
            <output className={s.sizeValue} aria-live="polite">
              {Math.round(textScale * 100)}%
            </output>
            <button
              type="button"
              className={s.sizeButton}
              onClick={() => size(1)}
              disabled={step >= TEXT_SCALES.length - 1}
              aria-label="Larger text"
            >
              A<span aria-hidden="true">+</span>
            </button>
          </div>
        </div>
        <div className={s.sizeRow}>
          <span className={s.settingLabel} id={`${panelId}-theme`}>
            Theme
          </span>
          <div className={s.themeControls} role="group" aria-labelledby={`${panelId}-theme`}>
            {THEMES.map((option) => (
              <button
                key={option.value}
                type="button"
                className={s.themeButton}
                aria-pressed={theme === option.value}
                onClick={() => {
                  if (theme === option.value) return;
                  setTheme(option.value);
                  audio.blip("click");
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
