/**
 * The small shared state between the loading screen (`components/home-boot/`, DOM, in the bundle of
 * every page) and the opening's scene (`runtime.ts`, three.js, in the engine's lazy chunk). Plain
 * numbers and flags in one object, read by whoever needs them in their own frame loop: never React
 * state, never an import of three. Keep this file tiny: it ships on every route.
 */

/** The scene's state, as the screen needs it. */
type BootStage =
  /** No scene runs the opening (no WebGL, the engine has not started, or the page is not the home). */
  | "none"
  /** The scene is being built (the drone, the pair, the logo, the marks). */
  | "building"
  /** The scene is built and drawing: it owns the intro. */
  | "ready"
  /** The scene failed: the opening goes on without it. */
  | "failed";

export interface BootBus {
  stage: BootStage;
  /** The drone is drawn on the stage (the loading screen's plain mark can leave). */
  droneShown: boolean;
  /** Seconds of the intro, or -1 before it starts. */
  introT: number;
  /** The press that is going on began on the drone (it must not count as "continue"). */
  pressOnDrone: boolean;
}

export const bootBus: BootBus = {
  stage: "none",
  droneShown: false,
  introT: -1,
  pressOnDrone: false,
};

/** Back to the start. */
export function resetBootBus(): void {
  bootBus.stage = "none";
  bootBus.droneShown = false;
  bootBus.introT = -1;
  bootBus.pressOnDrone = false;
}
