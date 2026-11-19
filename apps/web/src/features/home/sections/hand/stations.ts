/**
 * Where the hand's and the list's plays rest. The two sections are one choreography (the doll lands
 * in the palm, sits there, is tossed onto the first frame of the list, rides the frames, and hangs
 * from the edge when the last frame grows into the screen), driven by one carry (`carry.ts`).
 *
 * Beat time is a unit of its own (about a second of the scene at its usual pace), not screens:
 *
 *   hand, `t` 0 to 2.1     the hand rises, she lands, stands up, sits; the words and the hint come in
 *   list, `u` 0 to 11      0 to 1 the frame's toss and the first name; then one play for each frame
 *                          (u = 1 + k is the frame k in the window); 10 to 11 the last frame grows
 *
 * Between the hand's rest and the list's first play the scroll still moves the join (the hand comes
 * down a little, the words leave, the frame arrives behind the hand): it is a few tenths of a screen
 * and `timeline.ts` says how. This file imports no registry and no three, so the sections'
 * `index.ts` can read it.
 */
import type { BeatStep } from "../../kernel/beat";

/** The hand's last beat: the doll sits on the palm, the words and the hint stand, the fingers are live. */
export const HAND_LAST = 2.1;
/** The list's last beat: the tenth frame has grown into the screen. */
export const LIST_LAST = 11;

/** The number of frames of the strip: nine pictures and Selena in 3D. */
export const FRAME_COUNT = 10;

/** The hand's one play: the rise, the landing, the sitting and the words, in about two seconds. */
export const HAND_STEPS: readonly BeatStep[] = [
  { atScreens: 0.2, to: HAND_LAST, seconds: 2.1, ease: "linear" },
];

/**
 * Screens of scroll between two frames of the list (the dwell the visitor stands in). Each frame is
 * a name that leads to a page, so it takes more scroll than a picture would (the owner's threshold).
 */
const STEP = 0.55;
/** Where the toss fires, in screens after the list's start (the hand's tail ends before it). */
const FIRST_AT = 0.5;

/**
 * The list's plays: the toss onto the first frame, nine turns of the strip, the growth of the last
 * frame. Frame `k` rests after play `k` has fired.
 */
export const LIST_STEPS: readonly BeatStep[] = [
  // She crouches, is tossed to the frame and the hand sinks away. The beats are eased inside.
  { atScreens: FIRST_AT, to: 1, seconds: 2, ease: "linear" },
  ...Array.from({ length: FRAME_COUNT - 1 }, (_, i): BeatStep => ({
    atScreens: FIRST_AT + STEP * (i + 1),
    to: 2 + i,
    seconds: 0.7,
    ease: "inOut",
  })),
  // The window grows into the whole screen; the growth is eased inside the carry.
  { atScreens: FIRST_AT + STEP * FRAME_COUNT, to: LIST_LAST, seconds: 1.8, ease: "linear" },
];

/**
 * The scroll, in screens after the list's start, that rests on frame `i`: halfway between the play
 * that brought it and the next one. A control that takes the keyboard focus moves the page here.
 */
export function frameRestScreens(i: number): number {
  const k = Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(i)));
  return FIRST_AT + STEP * k + STEP / 2;
}
