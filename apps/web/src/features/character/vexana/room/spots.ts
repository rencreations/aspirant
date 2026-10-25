import type { Spot } from "../../stage/hotspots";
import { HOTSPOT_PATHS as TRACKED, HOTSPOT_STEP } from "./hotspots.generated";

export { HOTSPOT_STEP };

/**
 * The touch points on her picture, tracked through the idle loop by `scripts/vexana/stage-track.py`.
 * The ids are the names of the tracked paths: her left hand, the Guardian at her back, and a spot
 * beside her face (not on it). Each plays one of the three shorts. The wording is plain on purpose:
 * a button says what it does.
 */
export const SPOTS: readonly Spot[] = [
  {
    id: "left-hand",
    short: "short-2",
    label: "Her hand",
    action: "Play the animation of her left hand",
  },
  {
    id: "big-thing",
    short: "short-3",
    label: "The Guardian",
    action: "Play the animation of the Guardian",
  },
  { id: "face", short: "short-1", label: "Her gaze", action: "Play the animation of her face" },
];

/** The paths of the three points (the fourth tracked path is the middle of the left side). */
export const HOTSPOT_PATHS = {
  "left-hand": TRACKED["left-hand"],
  "big-thing": TRACKED["big-thing"],
  face: TRACKED.face,
};

/** A short line for each point, shown under the picture while nothing has been touched yet. */
export const HINTS = [
  "Touch her hand",
  "Touch the Guardian",
  "Touch beside her face",
  "Or change her pose",
] as const;
