/**
 * The beats of the bolt and the fall, and where their plays rest. The two sections draw one scene
 * (`scene.ts`), driven by one pure function of the beat time `t` (`journey.ts`). Beat time is a unit
 * of its own (about a second of the scene at its usual pace), not screens of scroll: the sections'
 * lengths are written in their `index.ts` and no beat depends on them.
 *
 * The scene is a row of stations. The visitor rests on one and scrolls to the next threshold, where
 * the scene plays by itself and the scroll is held until it ends:
 *
 *   0     the dark and the aurora; nothing has come yet
 *   1.3   the dragon has flown in along the path and hovers at the middle; the first pair is in focus
 *   1.8, 2.3, 2.8, 3.3   the wheel has turned to the next pair (one play each)
 *   6.6   the doll was thrown off the head and has fallen; "5 Phases" and "10 Characters" have been
 *
 * This file imports no registry and no three, so the sections' `index.ts` can read it.
 */
import type { BeatStep } from "../../kernel/beat";

/** The beats, in beat time. */
export const BEAT = {
  /** The dragon starts to come in from the lower right. */
  enter: 0.06,
  /** The barrel roll of the arrival: from here to a little before `arrive`. */
  rollFrom: 0.3,
  /** The dragon is at the middle and hovers until `leave`. */
  arrive: 1.15,
  leave: 3.3,
  /** The doll is thrown off the head. */
  launch: 3.9,
  /** The dragon is at 75 percent of its path and the camera takes over. */
  at75: 4.0,
  /** The end of the fall: the doll upright at the middle top (joint J6). */
  end: 6.6,
} as const;

/** The wheel: the pair `i` is in focus at `WHEEL_FROM + i * WHEEL_STEP`, and every station is one. */
export const WHEEL_FROM = 1.3;
export const WHEEL_STEP = 0.5;
export const WHEEL_ITEMS = 5;

/** The last station of the bolt section: the fifth pair in focus. */
export const BOLT_LAST = WHEEL_FROM + (WHEEL_ITEMS - 1) * WHEEL_STEP;

/**
 * The plays of the bolt section: the arrival, then one turn of the wheel for each pair. `atScreens`
 * is the scroll after the section's start at which the play fires. The last threshold must be at
 * least the fall's lead (0.5) before the end of the section, so its play is over before the fall's
 * scene is on screen (`stations.test.ts` checks it).
 */
export const BOLT_STEPS: readonly BeatStep[] = [
  // The path brakes by itself (it comes in fast and settles), so the clock is straight.
  { atScreens: 0.25, to: WHEEL_FROM, seconds: 1.6, ease: "linear" },
  { atScreens: 0.75, to: WHEEL_FROM + WHEEL_STEP, seconds: 0.6, ease: "inOut" },
  { atScreens: 1.2, to: WHEEL_FROM + 2 * WHEEL_STEP, seconds: 0.6, ease: "inOut" },
  { atScreens: 1.65, to: WHEEL_FROM + 3 * WHEEL_STEP, seconds: 0.6, ease: "inOut" },
  { atScreens: 2.1, to: BOLT_LAST, seconds: 0.6, ease: "inOut" },
];

/** The plays of the fall section: the throw and the fall in one scene of about three seconds. */
export const FALL_STEPS: readonly BeatStep[] = [
  { atScreens: 0.2, to: BEAT.end, seconds: 3, ease: "inOutSoft", back: 0.6 },
];
