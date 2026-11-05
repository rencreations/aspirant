import type { StageState } from "@/features/character/stage/director";
import {
  PAGE_NAMES,
  SHORT_NAMES,
  type SceneName,
  type Timeline,
} from "@/features/character/stage/timeline";

import { sceneFiles } from "./bundle";
import type { AnimClip } from "./types";

/** A button of the interaction panel: one clip, and the key that presses it. */
export interface RoomButton {
  clip: AnimClip;
  /** The digit that presses it, `1` to `9`. Null for the welcome, which is the Space bar. */
  key: number | null;
  /** The files that must be in memory before it can play. Empty for the welcome and the idle loop. */
  files: string[];
}

const isScene = (scene: string): scene is SceneName =>
  (PAGE_NAMES as readonly string[]).includes(scene) ||
  (SHORT_NAMES as readonly string[]).includes(scene);

/**
 * The buttons of one character, in the order of the data file. Digits 1 to 9 go to everything
 * except the welcome (Space), so the idle loop is `1`, the poses follow and then the short clips.
 * A clip the timeline has no video for is left out.
 */
export function buildButtons(clips: readonly AnimClip[], timeline: Timeline | null): RoomButton[] {
  let digit = 0;
  const out: RoomButton[] = [];
  for (const clip of [...clips].sort((a, b) => a.order - b.order)) {
    const scene = clip.scene;
    const files = scene && isScene(scene) && timeline ? sceneFiles(timeline, scene) : [];
    if (scene && timeline && files.length === 0) continue;
    const key = clip.kind === "welcome" || digit >= 9 ? null : (digit += 1);
    out.push({ clip, key, files });
  }
  return out;
}

/** The button a digit key presses. */
export function buttonForDigit(buttons: readonly RoomButton[], digit: number): RoomButton | null {
  return buttons.find((b) => b.key === digit) ?? null;
}

/** The index of the character a step away in the picker, wrapping at both ends. */
export function stepIndex(index: number, step: 1 | -1, count: number): number {
  return (index + step + count) % count;
}

/** Seconds as text for a clip length: `4.2 s`. */
export function formatSeconds(seconds: number | null): string {
  return seconds === null ? "length not known yet" : `${seconds.toFixed(1)} s`;
}

/** Length in seconds of a scene's files, from the timeline (a pose is its entrance, one loop and its exit). */
export function sceneSeconds(timeline: Timeline, scene: SceneName): number {
  const fps = timeline.fps;
  if ((PAGE_NAMES as readonly string[]).includes(scene)) {
    const page = timeline.pages[scene as (typeof PAGE_NAMES)[number]];
    return (page.in.frames + page.loop.frames + page.out.frames) / fps;
  }
  return timeline.shorts[scene as (typeof SHORT_NAMES)[number]].frames / fps;
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

/** Bytes as text for the loading line: `12.3 MB`. */
export function formatMegabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export type RoomPhase = "loading" | "ready" | "preparing";

interface HintInput {
  phase: RoomPhase;
  state: StageState;
  /** The label of the clip that is playing or queued. */
  label: string | null;
  /** Seconds to wait for the loop to reach the frame, when known. */
  waitSeconds: number | null;
  /** The default hint of the data file. */
  base: string;
}

/** The line under the stage. Plain sentences that say what is happening now. */
export function hintFor({ phase, state, label, waitSeconds, base }: HintInput): string {
  if (phase === "preparing") return "Preparing. This animation is not ready yet.";
  if (phase === "loading") return "Loading. The welcome and the idle loop come first.";
  switch (state.mode) {
    case "boot":
      return "Starting.";
    case "welcome":
      return "The welcome plays once, then the idle loop. Space plays it again.";
    case "queued":
      if (state.loading) return `${label ?? "The clip"} is still loading.`;
      return waitSeconds === null
        ? `${label ?? "The clip"} starts when the loop reaches its frame.`
        : `${label ?? "The clip"} starts in ${waitSeconds.toFixed(1)} s, when the loop reaches its frame.`;
    case "intro":
    case "page":
      return "Holding the pose for one loop. It cuts back to idle on its own, or press Idle.";
    case "leaving":
    case "outro":
      return "Going back to idle.";
    case "short":
      return `Playing ${label ?? "the clip"}. It cuts back to idle on its own.`;
    default:
      return base;
  }
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

/**
 * The colour a character's gate is drawn with on her dark ink: her primary, unless that is too
 * dark to read on the ink (Ruby's navy), then the first of her other colours that is not.
 */
export function accentOf(palette: {
  primary: string;
  secondary: string;
  glow: string;
  ink: string;
}): string {
  const candidates = [palette.primary, palette.secondary, palette.glow];
  return candidates.find((c) => contrast(c, palette.ink) >= 4.5) ?? palette.glow;
}

/** Black or white, whichever reads on `background`. */
export function onColour(background: string): string {
  return contrast(background, "#0b0b0e") >= contrast(background, "#ffffff") ? "#0b0b0e" : "#ffffff";
}

// What is on screen ---------------------------------------------------------------------------------

/** What the stage shows now, for the ruler and the labels. */
export interface NowPlaying {
  /** Changes when a new part starts. Null before the stage has begun. */
  key: string | null;
  /** The name of the clip. */
  label: string;
  /** Which part of it: `loop`, `entrance`, `way back`, or empty. */
  part: string;
  /** Length of the part in milliseconds, null when not known. */
  durMs: number | null;
  loop: boolean;
  /** The button that made it, for the length shown in the panel. */
  button: RoomButton | null;
}

const BEFORE: NowPlaying = {
  key: null,
  label: "Starting",
  part: "",
  durMs: null,
  loop: false,
  button: null,
};

/** Describe what the stage is showing from the director's state, the timeline and the buttons. */
export function nowPlaying(
  state: StageState,
  timeline: Timeline | null,
  buttons: readonly RoomButton[],
): NowPlaying {
  if (!timeline) return BEFORE;
  const fps = timeline.fps;
  const ms = (frames: number) => (frames / fps) * 1000;
  const welcome = buttons.find((b) => b.clip.kind === "welcome") ?? null;
  const idle = buttons.find((b) => b.clip.kind === "idle") ?? null;
  const scene = state.scene;
  const sceneButton = scene ? (buttons.find((b) => b.clip.scene === scene) ?? null) : null;
  const label = sceneButton?.clip.label ?? "Clip";
  const isPage = scene !== null && (PAGE_NAMES as readonly string[]).includes(scene);
  const page = isPage ? timeline.pages[scene as (typeof PAGE_NAMES)[number]] : null;
  const idleLoop: NowPlaying = {
    key: "idle",
    label: "Idle",
    part: "loop",
    durMs: ms(timeline.loopFrames),
    loop: true,
    button: idle,
  };
  switch (state.mode) {
    case "boot":
      return BEFORE;
    case "welcome":
      return {
        key: "welcome",
        label: "Welcome",
        part: "",
        durMs: welcome?.clip.dur ? welcome.clip.dur * 1000 : null,
        loop: false,
        button: welcome,
      };
    case "intro":
      return page
        ? {
            key: `${scene}-in`,
            label,
            part: "entrance",
            durMs: ms(page.in.handFrame),
            loop: false,
            button: sceneButton,
          }
        : idleLoop;
    case "page":
    case "leaving":
      return page
        ? {
            key: `${scene}-loop`,
            label,
            part: "loop",
            durMs: ms(page.loop.frames),
            loop: true,
            button: sceneButton,
          }
        : idleLoop;
    case "outro":
      return page
        ? {
            key: `${scene}-out`,
            label,
            part: "way back",
            durMs: ms(page.out.frames),
            loop: false,
            button: sceneButton,
          }
        : idleLoop;
    case "short": {
      const short =
        scene && !isPage ? timeline.shorts[scene as (typeof SHORT_NAMES)[number]] : null;
      return short
        ? {
            key: String(scene),
            label,
            part: "",
            durMs: ms(short.frames),
            loop: false,
            button: sceneButton,
          }
        : idleLoop;
    }
    default:
      return idleLoop;
  }
}
