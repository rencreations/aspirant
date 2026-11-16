import { create } from "zustand";

import type { Box } from "./film-geometry";

/**
 * What the parts of the About page tell each other. The opening of the page is one scene played by
 * three parts that do not import each other: the director (a clock), the drone (a WebGL layer in a
 * lazy chunk) and the first screen (plain markup). They meet here.
 *
 * The phases of the opening, in order:
 * - `wait`: nothing is shown yet (the loading screen is up, or the drone has not arrived).
 * - `title`: the drone crosses the title from right to left and the title appears in its trail.
 * - `landing`: the drone turns back at the left edge and comes down to its place.
 * - `landed`: the drone sits. The description and the reel appear now.
 * - `done`: the opening is over. A visit that skips it (a test, a page opened part way down, a
 *   browser without WebGL after its plain reveal) goes straight here.
 *
 * The page root carries the phase as `data-about-intro`, and the first screen hides its parts by
 * it in CSS, always under `:root.js`, so a visitor without scripts sees everything.
 */
export type IntroPhase = "wait" | "title" | "landing" | "landed" | "done";

/** `pending` until the scene has drawn the drone, `ready` then, `none` when it never will. */
export type EngineState = "pending" | "ready" | "none";

interface AboutStage {
  readonly phase: IntroPhase;
  readonly engine: EngineState;
}

export const useAboutStage = create<AboutStage>()(() => ({ phase: "wait", engine: "pending" }));

/** The title's side of the reveal. The first screen registers it, the director drives it. */
export interface TitleReveal {
  /** The box of the whole title (both words) in the viewport, measured now. */
  rect: () => DOMRect;
  /**
   * The drone flies right to left: everything of the title to the right of this viewport x is
   * shown, the rest is still hidden. Called every frame of the pass, with a falling x.
   */
  setEdge: (x: number) => void;
  /** Show the whole title at once and drop whatever the reveal needed. Safe to call twice. */
  finish: () => void;
}

/** A point of the viewport, in CSS pixels. */
export interface ViewPoint {
  x: number;
  y: number;
}

/**
 * Things that change too often, or are too big, for a store. Plain fields, read each frame.
 * `title` is set by the first screen while it is mounted. `gaze` is a point the drone should look
 * at instead of the pointer (a row the visitor hovers), or null. `film` is the box of the reel's
 * picture in the viewport right now, written by the film each frame it moves (null when the film
 * is not on the page): the drone is behind it, so it is what can hide the drone.
 */
export const stageRefs: { title: TitleReveal | null; gaze: ViewPoint | null; film: Box | null } = {
  title: null,
  gaze: null,
  film: null,
};

/** Back to the start, for the next visit of the page. */
export function resetAboutStage(): void {
  useAboutStage.setState({ phase: "wait", engine: "pending" });
  stageRefs.title = null;
  stageRefs.gaze = null;
  stageRefs.film = null;
}
