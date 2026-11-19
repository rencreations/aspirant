/**
 * Where the hand's and the list's zones are. The two sections are one choreography (the doll lands in
 * the palm, sits there, is tossed onto the first frame of the list, rides the frames, and hangs from the
 * edge when the last frame grows into the screen), driven by one carry (`carry.ts`). Every scene is a
 * scroll zone (`kernel/scrub.ts`): the visitor scrolls and it plays, up and down, and a visitor who stops
 * inside one is carried to its nearer end. Between two zones the page rests.
 *
 * Beat time is a unit of its own (about a second of the scene at its usual pace), not screens:
 *
 *   hand, `t` 0 to 2.1     the hand rises, she lands, stands up, sits; the words and the hint come in
 *   list, `u` 0 to 11      0 to 1 the frame's toss and the first name; then one zone for each frame
 *                          (u = 1 + k is the frame k in the window); 10 to 11 the last frame grows
 *
 * Between the hand's rest and the list's toss the scroll still moves the join (the hand comes down a
 * little, the words leave, the frame arrives behind the hand): it is a few tenths of a screen of the
 * hand's end and the list's lead, and `timeline.ts` says how. This file imports no registry and no
 * three, so the sections' `index.ts` can read it.
 */
import { zoneLength, type BeatStep } from "../../kernel/beat";

/** The hand's last beat: the doll sits on the palm, the words and the hint stand, the fingers are live. */
export const HAND_LAST = 2.1;
/** The list's last beat: the tenth frame has grown into the screen. */
export const LIST_LAST = 11;

/** The number of frames of the strip: nine pictures and Selena in 3D. */
export const FRAME_COUNT = 10;

/**
 * The hand's one zone: the rise, the landing, the sitting and the words. The beats ease inside (the
 * palm, the fall and the words each have their own curve), so the scroll maps to them straight.
 */
const HAND_AT = 0.1;
const HAND_SPAN = 1.2;
export const HAND_STEPS: readonly BeatStep[] = [
  { atScreens: HAND_AT, spanScreens: HAND_SPAN, to: HAND_LAST, seconds: 1, ease: "linear" },
];

/**
 * The rest after the rise, in screens: the words ("2022 - Present", the description, the hint) stand
 * and the fingers are live, so it is long. The join that follows (0.4: the hand comes down, the words
 * leave, the frame arrives, `JOIN_AT` in `timeline.ts`) is in the same dwell.
 */
export const HAND_REST = 0.9;
export const HAND_JOIN = 0.4;
export const HAND_DWELL = HAND_REST + HAND_JOIN;

/** The hand's length in screens. */
export const HAND_SCREENS = zoneLength(HAND_STEPS, HAND_DWELL);

/**
 * Where the toss starts, in screens after the list's start: the hand's tail (0.4) is over, so the
 * toss is the only scene on the scroll.
 */
export const LIST_FIRST_AT = 0.4;
/** The toss: she crouches, is tossed to the frame and the hand sinks away. */
const TOSS_SPAN = 0.8;
/** A frame is a name that leads to a page and a picture to open, so the rest on it is real. */
export const FRAME_SPAN = 0.35;
export const FRAME_REST = 0.55;
/** The growth of Selena's frame into the screen. */
const GROW_SPAN = 1;

/** Screens after the list's start where frame `k` (1 to 9) starts to arrive. */
function turnAt(k: number): number {
  return LIST_FIRST_AT + TOSS_SPAN + FRAME_REST + (k - 1) * (FRAME_SPAN + FRAME_REST);
}

/**
 * The list's zones: the toss onto the first frame, nine turns of the strip, the growth of the last
 * frame. Frame `k` rests after zone `k` has ended. The turns ease at their ends (the strip lands), the
 * toss and the growth ease inside the carry.
 */
export const LIST_STEPS: readonly BeatStep[] = [
  // She crouches, is tossed to the frame and the hand sinks away. The beats are eased inside.
  { atScreens: LIST_FIRST_AT, spanScreens: TOSS_SPAN, to: 1, seconds: 0.8, ease: "linear" },
  ...Array.from({ length: FRAME_COUNT - 1 }, (_, i): BeatStep => ({
    atScreens: turnAt(i + 1),
    spanScreens: FRAME_SPAN,
    to: 2 + i,
    seconds: 0.5,
    ease: "inOutSoft",
  })),
  // The window grows into the whole screen; the growth is eased inside the carry.
  {
    atScreens: turnAt(FRAME_COUNT - 1) + FRAME_SPAN + FRAME_REST,
    spanScreens: GROW_SPAN,
    to: LIST_LAST,
    seconds: 0.9,
    ease: "linear",
  },
];

/**
 * The rest after the growth: the screen is Selena's, and the next section's lead (half a screen)
 * begins in it.
 */
export const LIST_DWELL = 0.5;

/** The list's length in screens. */
export const LIST_SCREENS = zoneLength(LIST_STEPS, LIST_DWELL);

/**
 * The scroll, in screens after the list's start, that rests on frame `i`: the middle of the rest
 * after the zone that brought it. A control that takes the keyboard focus moves the page here, so the
 * idle snap never has to move it.
 */
export function frameRestScreens(i: number): number {
  const k = Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(i)));
  const end = k === 0 ? LIST_FIRST_AT + TOSS_SPAN : turnAt(k) + FRAME_SPAN;
  return end + FRAME_REST / 2;
}
