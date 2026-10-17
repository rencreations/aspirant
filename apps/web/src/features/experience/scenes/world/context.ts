import { createContext, useContext } from "react";
import { Color } from "three";

import { clamp } from "@/lib/math";

import { CHAPTERS } from "../parts";
import type { Drive } from "./types";

/** Per-slot clock. A slot that is fading out stops following the reader (`live` false). */
export interface WorldClock {
  time: number;
  chapter: number;
  part: number;
  story: number;
  beat: number;
  /** Damped pointer, -1 to 1. */
  px: number;
  py: number;
  /** Seconds since this world mounted. */
  age: number;
  live: boolean;
  /** Quality scale for counts: 1 desktop, 0.5 phones. */
  quality: number;
}

export function createClock(quality: number): WorldClock {
  return {
    time: 0,
    chapter: 0,
    part: 0,
    story: 0,
    beat: 0,
    px: 0,
    py: 0,
    age: 0,
    live: true,
    quality,
  };
}

export const WorldContext = createContext<WorldClock | null>(null);

export function useClock(): WorldClock {
  const clock = useContext(WorldContext);
  if (!clock) throw new Error("useClock outside a World");
  return clock;
}

/** Resolve a number-or-drive value against the clock. */
export function driven(value: number | Drive | undefined, clock: WorldClock, fallback = 0): number {
  if (value === undefined) return fallback;
  if (typeof value === "number") return value;
  if (value === "chapter") return clock.chapter;
  if (value === "part") return clock.part;
  return (clock.time * 0.05) % 1;
}

const chapterOrder = (() => {
  const byPart = new Map<number, string[]>();
  for (const [id, chapter] of Object.entries(CHAPTERS)) {
    const list = byPart.get(chapter.part) ?? [];
    list.push(id);
    byPart.set(chapter.part, list);
  }
  const result = new Map<string, { index: number; count: number }>();
  for (const list of byPart.values()) {
    list.forEach((id, index) => result.set(id, { index, count: list.length }));
  }
  return result;
})();

/** Progress through the Part, 0 to 1, from the chapter and the progress inside it. */
export function partProgress(chapterId: string | null, chapterProgress: number): number {
  const place = chapterId ? chapterOrder.get(chapterId) : undefined;
  if (!place) return 0;
  return clamp((place.index + clamp(chapterProgress)) / place.count);
}

const colorCache = new Map<string, Color>();
/** Linear-space colour from an sRGB hex (cached; do not mutate the result). */
export function col(hex: string): Color {
  let c = colorCache.get(hex);
  if (!c) {
    c = new Color(hex);
    colorCache.set(hex, c);
  }
  return c;
}
