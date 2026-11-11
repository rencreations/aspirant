import type { StageState } from "@/features/character/stage/director";
import {
  isPage,
  SHORT_NAMES,
  type SceneName,
  type Timeline,
} from "@/features/character/stage/timeline";

import type { RoomButton } from "./room-math";

/**
 * The buttons of the full screen view as a state machine. What can be pressed depends on what the
 * stage engine is doing, so the view only shows what works at that moment. Everything here is
 * read from the engine's own data (its timeline and its state), never from the names of the clips.
 */

/** What a button plays, by the engine: the welcome, a pose that loops, or an action that plays once. */
export type Role = "welcome" | "pose" | "action";

/**
 * The role of a clip by the stage engine. A scene that is a page of the timeline is a pose: an
 * entrance, a loop that holds, and an exit. A scene that is a short of the timeline is an action:
 * one video that hands back to the idle loop by itself. No scene is the welcome. Null when the
 * timeline has no video for the scene.
 */
export function roleOf(scene: string | null, timeline: Timeline | null): Role | null {
  if (scene === null) return "welcome";
  if ((SHORT_NAMES as readonly string[]).includes(scene)) {
    if (timeline && !timeline.shorts[scene as (typeof SHORT_NAMES)[number]]?.file) return null;
    return "action";
  }
  if (isPage(scene as SceneName)) {
    const page = timeline?.pages[scene as Exclude<SceneName, (typeof SHORT_NAMES)[number]>];
    if (timeline && !page?.loop.file) return null;
    return "pose";
  }
  return null;
}

/**
 * - first-welcome: the view opened and the welcome plays. Only the way back shows.
 * - welcome-again: the visitor pressed Welcome. It plays again, nothing else shows, no skip.
 * - idle: she is in her idle pose. Every option shows.
 * - loading: an option was pressed and its clip is not in yet, or it waits for its frame. Only
 *   the pressed one shows, with its state.
 * - pose: a pose plays and loops. Only "Back to idle" shows.
 * - action: an action plays. Nothing shows until she is back in her idle pose.
 * - leaving: the visitor left a pose and its exit plays. Nothing shows until she is back.
 */
export type FullPhase =
  "first-welcome" | "welcome-again" | "idle" | "loading" | "pose" | "action" | "leaving";

export interface PhaseInput {
  /** The character's welcome and idle loop: still loading, in memory, or no stage at all. */
  core: "loading" | "ready" | "missing";
  stage: Pick<StageState, "mode" | "scene" | "ui" | "next" | "leaving">;
  /** The welcome on show was asked for with the Welcome button. */
  replay: boolean;
  /** A scene pressed before its files were in memory, or null. */
  held: SceneName | null;
}

export interface Phase {
  phase: FullPhase;
  /** The scene the one button left is about (loading, pose), or the scene playing. */
  scene: SceneName | null;
}

/** The phase of the full screen view, from the engine's state. */
export function fullPhase({ core, stage, replay, held }: PhaseInput): Phase {
  const welcome: FullPhase = replay ? "welcome-again" : "first-welcome";
  if (core === "missing") return { phase: "idle", scene: null };
  if (core === "loading") return { phase: welcome, scene: null };
  const { mode, scene, ui, next, leaving } = stage;
  if (mode === "boot" || mode === "welcome") return { phase: welcome, scene: null };
  if (held) return { phase: "loading", scene: held };
  // Chosen while she handed back to the idle loop: it starts when she idles.
  if (next) return { phase: "loading", scene: next };
  // Waiting for the idle loop to reach the frame the clip starts on.
  if (mode === "queued") return { phase: "loading", scene };
  const pose = scene !== null && isPage(scene);
  if (mode === "intro" || mode === "page") return { phase: leaving ? "leaving" : "pose", scene };
  // The entrance hands over to the pose's loop (the engine blocks a second hand over this way).
  if (mode === "returning" && pose && !leaving && !ui) return { phase: "pose", scene };
  // The engine says the panel may show: she is in her idle pose, also a moment before the clip has
  // finished handing back (`uiFrame` of the timeline).
  if (ui) return { phase: "idle", scene: null };
  return { phase: pose ? "leaving" : "action", scene };
}

/** One button as the view draws it. */
export interface OptionView {
  button: RoomButton;
  /** It can be pressed now, so it shows. */
  shown: boolean;
  /** The pose that plays: the button takes the visitor back to idle. */
  back: boolean;
}

/** Which buttons show in a phase: all of them at rest, the pressed one while it loads, the way back in a pose. */
export function optionViews(phase: Phase, buttons: readonly RoomButton[]): OptionView[] {
  return buttons.map((button) => {
    const mine = phase.scene !== null && button.clip.scene === phase.scene;
    switch (phase.phase) {
      case "idle":
        return { button, shown: true, back: false };
      case "loading":
        return { button, shown: mine, back: false };
      case "pose":
        return { button, shown: mine, back: mine };
      default:
        return { button, shown: false, back: false };
    }
  });
}

/** The state the button that is left shows while its clip is on the way. */
export type Wait = "loading" | "starting";

/** Loading while its files are not in memory, starting while the stage waits for its frame. */
export function waitOf(phase: Phase, held: SceneName | null): Wait | null {
  if (phase.phase !== "loading") return null;
  return held !== null && held === phase.scene ? "loading" : "starting";
}
