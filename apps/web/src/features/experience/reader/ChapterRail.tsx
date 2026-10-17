"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { audio } from "@/lib/audio";

import { useExperience } from "../contract";
import s from "./chrome.module.css";
import { useReader } from "./reader-context";
import { getPartMeta, PARTS, unitIndex, unitLabel, UNITS } from "./story-data";

const LAST = UNITS.length - 1;

function describe(i: number): string {
  const unit = UNITS[i];
  if (!unit) return "Before Chapter 1";
  return `${unitLabel(unit)}: ${unit.title}. ${getPartMeta(unit.part)?.label ?? ""}`;
}

/** First unit index of the Part before or after the one holding `i`. */
function partStep(i: number, dir: 1 | -1): number {
  const part = UNITS[Math.max(0, i)]?.part ?? 1;
  const target = getPartMeta(part + dir);
  if (!target) return dir === 1 ? LAST : 0;
  return unitIndex(target.chapterIds[0] ?? "");
}

/**
 * The chapter timeline on the left (desktop): 60 ticks and the interludes, grouped by Part,
 * the current chapter lit. It is one slider control, so every tick stays reachable without
 * 62 tiny targets: hover or arrow keys preview a chapter title, click or Enter goes there.
 */
export function ChapterRail() {
  const chapterId = useExperience((st) => st.chapterId);
  const { jumpTo } = useReader();
  const current = chapterId ? unitIndex(chapterId) : -1;
  const [preview, setPreview] = useState<number | null>(null);
  const [tipTop, setTipTop] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const commitTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(commitTimer.current), []);

  const tickTop = (i: number) => {
    const track = trackRef.current;
    const tick = track?.querySelector<HTMLElement>(`[data-i="${i}"]`);
    if (!track || !tick) return 0;
    return tick.getBoundingClientRect().top - track.getBoundingClientRect().top + tick.offsetHeight / 2;
  };

  const go = (i: number) => {
    const unit = UNITS[i];
    if (!unit) return;
    audio.blip("confirm");
    void jumpTo(unit.id, { focus: false });
  };

  const nearest = (clientY: number) => {
    const ticks = trackRef.current?.querySelectorAll<HTMLElement>("[data-i]");
    if (!ticks) return null;
    let best: number | null = null;
    let bestD = Infinity;
    for (const tick of ticks) {
      const r = tick.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - clientY);
      if (d < bestD) {
        bestD = d;
        best = Number(tick.dataset.i);
      }
    }
    return best;
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const i = nearest(e.clientY);
    if (i === null || i === preview) return;
    if (e.pointerType === "mouse") audio.blip("hover");
    setPreview(i);
    setTipTop(tickTop(i));
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const from = preview ?? Math.max(0, current);
    let next: number | null = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = Math.min(LAST, from + 1);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = Math.max(0, from - 1);
    else if (e.key === "PageDown") next = partStep(from, 1);
    else if (e.key === "PageUp") next = partStep(from, -1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = LAST;
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      window.clearTimeout(commitTimer.current);
      go(from);
      return;
    }
    if (next === null) return;
    e.preventDefault();
    setPreview(next);
    setTipTop(tickTop(next));
    window.clearTimeout(commitTimer.current);
    const target = next;
    commitTimer.current = window.setTimeout(() => go(target), 650);
  };

  const shown = preview ?? current;
  return (
    <nav className={s.rail} aria-label="Chapters" data-overlay="rail">
      <div
        ref={trackRef}
        className={s.railTrack}
        role="slider"
        tabIndex={0}
        aria-label="Chapter timeline"
        aria-orientation="vertical"
        aria-valuemin={1}
        aria-valuemax={UNITS.length}
        aria-valuenow={Math.max(0, shown) + 1}
        aria-valuetext={describe(shown)}
        onPointerMove={onMove}
        onPointerLeave={() => setPreview(null)}
        onBlur={() => setPreview(null)}
        onClick={(e) => {
          const i = nearest(e.clientY);
          if (i !== null) go(i);
        }}
        onKeyDown={onKey}
      >
        {PARTS.map((part) => {
          const first = unitIndex(part.chapterIds[0] ?? "");
          const inPart = current >= first && current < first + part.chapterIds.length;
          return (
            <div key={part.number} className={s.railPart} data-current={inPart ? "true" : undefined}>
              <span className={s.railPartNum} aria-hidden="true">
                {String(part.number).padStart(2, "0")}
              </span>
              <span className={s.railTicks} aria-hidden="true">
                {part.chapterIds.map((id) => {
                  const i = unitIndex(id);
                  return (
                    <span
                      key={id}
                      data-i={i}
                      className={cn(s.tick, UNITS[i]?.kind === "interlude" && s.tickInterlude)}
                      data-state={i === current ? "current" : i < current ? "read" : i === preview ? "preview" : undefined}
                    />
                  );
                })}
              </span>
            </div>
          );
        })}
        {preview !== null && (
          <span className={s.railTip} style={{ top: tipTop }} aria-hidden="true">
            <span className="hud-label">{UNITS[preview] ? unitLabel(UNITS[preview]) : ""}</span>
            <span className={s.railTipTitle}>{UNITS[preview]?.title}</span>
          </span>
        )}
      </div>
    </nav>
  );
}
