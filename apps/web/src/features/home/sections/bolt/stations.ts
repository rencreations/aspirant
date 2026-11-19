/**
 * The beats of the bolt and the fall, and the scroll zones that drive them. The two sections draw one
 * scene (`scene.ts`), driven by one pure function of the beat time `t` (`journey.ts`). Beat time is a
 * unit of its own (about a second of the scene at its usual pace), not screens of scroll: the sections'
 * lengths are written in their `index.ts` and no beat depends on them.
 *
 * The scene is a row of rests joined by ZONES (`kernel/scrub.ts`). The visitor scrolls through a zone
 * and the scene plays with the scroll, up and down; a visitor who stops inside one is carried to its
 * nearer end. Nothing runs on a clock and nothing holds the page.
 *
 *   0     the dark and the aurora; nothing has come yet
 *   1.3   the dragon has flown in along the path and hovers at the middle; the first pair is in focus
 *   1.8, 2.3, 2.8, 3.3   the wheel has turned to the next pair (one zone each)
 *   4.85  the doll was thrown off the head and falls; "5 Phases" stands
 *   6.6   she has fallen and stood up; "5 Phases" has left and "10 Characters" stands
 *
 * This file imports no registry and no three, so the sections' `index.ts` can read it.
 */
import { zoneLength, type BeatStep } from "../../kernel/beat";

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
  /** "5 Phases" stands whole here: the middle rest of the fall. */
  phases: 4.85,
  /** The end of the fall: the doll upright at the middle top (joint J6). */
  end: 6.6,
} as const;

/** The wheel: the pair `i` is in focus at `WHEEL_FROM + i * WHEEL_STEP`, and every rest is one. */
export const WHEEL_FROM = 1.3;
export const WHEEL_STEP = 0.5;
export const WHEEL_ITEMS = 5;

/** The last rest of the bolt section: the fifth pair in focus. */
export const BOLT_LAST = WHEEL_FROM + (WHEEL_ITEMS - 1) * WHEEL_STEP;

/** Screens of scroll: the dragon's arrival, one turn of the wheel, and the rest between two zones. */
const ARRIVE_AT = 0.15;
const ARRIVE_SPAN = 1;
/** A pair is a word the visitor reads, so a turn is short and the rest after it is not. */
export const TURN_SPAN = 0.4;
export const TURN_REST = 0.4;

/**
 * The zones of the bolt section: the arrival (the path brakes by itself, so it is linear in the
 * scroll), then one turn of the wheel for each pair. `atScreens` is where the zone starts, in screens
 * after the section's start. The last zone must end at least the fall's lead (0.5) before the section's
 * end, so the fall's lead is a rest and never a second owner of the scroll (`stations.test.ts`).
 */
export const BOLT_STEPS: readonly BeatStep[] = [
  { atScreens: ARRIVE_AT, spanScreens: ARRIVE_SPAN, to: WHEEL_FROM, seconds: 1, ease: "linear" },
  ...Array.from({ length: WHEEL_ITEMS - 1 }, (_, i): BeatStep => ({
    atScreens: ARRIVE_AT + ARRIVE_SPAN + TURN_REST + i * (TURN_SPAN + TURN_REST),
    spanScreens: TURN_SPAN,
    to: WHEEL_FROM + (i + 1) * WHEEL_STEP,
    seconds: 0.5,
    ease: "inOutSoft",
  })),
];

/** The rest after the last turn: the fall's lead (0.5) is on it, and a little more. */
export const BOLT_DWELL = 0.6;

/** The bolt section's length in screens. */
export const BOLT_SCREENS = zoneLength(BOLT_STEPS, BOLT_DWELL);

/** Screens of the fall: the first zone starts a little after the section's start. */
const FALL_AT = 0.1;
const FALL_SPAN = 0.9;
/** "5 Phases" is information: it stands for a longer rest. */
const FALL_REST = 0.45;

/**
 * The zones of the fall section: the rear, the sneeze, the throw and the fall to "5 Phases"; a rest on
 * it; the rest of the fall to "10 Characters". Both ease at their ends (the rests are composed frames).
 */
export const FALL_STEPS: readonly BeatStep[] = [
  { atScreens: FALL_AT, spanScreens: FALL_SPAN, to: BEAT.phases, seconds: 0.9, ease: "inOutSoft" },
  {
    atScreens: FALL_AT + FALL_SPAN + FALL_REST,
    spanScreens: FALL_SPAN,
    to: BEAT.end,
    seconds: 0.9,
    ease: "inOutSoft",
  },
];

/**
 * The rest on "10 Characters" and the hand's lead (0.5 screens: the fingertips come up and the line
 * leaves upward, `CHARACTERS_OUT` in `fall/runtime.ts`) after it.
 */
export const FALL_DWELL = 0.3 + 0.5;

/** The fall section's length in screens. */
export const FALL_SCREENS = zoneLength(FALL_STEPS, FALL_DWELL);
