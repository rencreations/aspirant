import {
  PAGE_NAMES,
  SHORT_NAMES,
  type SceneName,
  type Timeline,
} from "@/features/character/stage/timeline";

import { sceneFiles } from "./bundle";
import type { AnimClip } from "./types";

/** A button of the full screen view: one clip, and the files it needs. */
export interface RoomButton {
  clip: AnimClip;
  /** The digit that presses it, `1` to `9`, in the order of the data file. */
  key: number | null;
  /** The files that must be in memory before it can play. Empty for the welcome and the idle loop. */
  files: string[];
}

const isScene = (scene: string): scene is SceneName =>
  (PAGE_NAMES as readonly string[]).includes(scene) ||
  (SHORT_NAMES as readonly string[]).includes(scene);

/**
 * The buttons of one character, in the order of the data file: the welcome, the poses, then the
 * short clips. The idle loop is the character at rest, not something to press, so it has no button.
 * A clip the timeline has no video for is left out. Digits 1 to 9 press them in order.
 */
export function optionButtons(clips: readonly AnimClip[], timeline: Timeline | null): RoomButton[] {
  let digit = 0;
  const out: RoomButton[] = [];
  for (const clip of [...clips].sort((a, b) => a.order - b.order)) {
    if (clip.kind === "idle") continue;
    const scene = clip.scene;
    const files = scene && isScene(scene) && timeline ? sceneFiles(timeline, scene) : [];
    if (scene && timeline && files.length === 0) continue;
    const key = digit >= 9 ? null : (digit += 1);
    out.push({ clip, key, files });
  }
  return out;
}

/** How much of a scene has arrived, 0 to 1, weighted by file size. */
export function sceneProgress(
  files: readonly string[],
  fraction: (file: string) => number,
  size: (file: string) => number,
): number {
  if (files.length === 0) return 1;
  let all = 0;
  let got = 0;
  for (const file of files) {
    const s = size(file);
    all += s;
    got += s * Math.min(1, fraction(file));
  }
  return all === 0 ? 0 : got / all;
}

// Colour ------------------------------------------------------------------------------------------

/** Relative luminance of a `#rrggbb` colour, 0 (black) to 1 (white). */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** Contrast ratio of two `#rrggbb` colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
