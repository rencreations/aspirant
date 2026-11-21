/**
 * Where the list's zones are (round six: the oryzo.ai strip). The list is one scroll story with three
 * parts, all scroll linked, up and down:
 *
 *  - the RISE, in the lead: the heading and the strip come up from below the screen while the pair
 *    descends above them (`LIST_LEAD` screens, plain scroll, no zone: the descent section's own scroll
 *    carries it);
 *  - a TURN of the strip for each frame: one zone, with a rest after it (the frame stands in the
 *    window, its name is a link, its picture opens);
 *  - the GROWTH of the last frame (Selena in 3D) into the whole screen.
 *
 * Beat time `u`: frame `k` rests at `u = k` (0 to 9) and the growth runs from 9 to `LIST_LAST`.
 * This file imports only pure modules, so the section's `index.ts` can read it.
 */
import { zoneLength, type BeatStep } from "../../kernel/beat";
import { LIST_LEAD } from "../descent/stations";

export { LIST_LEAD };

/** The number of frames of the strip: nine pictures and Selena in 3D. */
export const FRAME_COUNT = 10;
/** The list's last beat: the last frame has grown into the screen. */
export const LIST_LAST = 10;

/** The first frame rests this long before the first turn begins (screens after the section's start). */
const LIST_FIRST_AT = 0.4;
/** A turn of the strip, and the rest on the frame it brings. Oryzo's step is 0.75 screens. */
export const TURN_SPAN = 0.6;
const TURN_REST = 0.3;
/** The growth of the last frame into the screen. */
const GROW_SPAN = 1;

/** Screens after the list's start where the turn that brings frame `k` (1 to 9) begins. */
function turnAt(k: number): number {
  return LIST_FIRST_AT + (k - 1) * (TURN_SPAN + TURN_REST);
}

/**
 * The list's zones: nine turns of the strip and the growth of the last frame. The turns ease at their
 * ends (the strip lands), the growth is eased inside the runtime.
 */
export const LIST_STEPS: readonly BeatStep[] = [
  ...Array.from({ length: FRAME_COUNT - 1 }, (_, i): BeatStep => ({
    atScreens: turnAt(i + 1),
    spanScreens: TURN_SPAN,
    to: i + 1,
    seconds: 0.7,
    ease: "inOutSoft",
  })),
  {
    atScreens: turnAt(FRAME_COUNT - 1) + TURN_SPAN + TURN_REST,
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
const LIST_DWELL = 0.5;

/** The list's length in screens. */
export const LIST_SCREENS = zoneLength(LIST_STEPS, LIST_DWELL);

/**
 * The scroll, in screens after the list's start, that rests on frame `i`: the middle of the rest
 * after the turn that brought it. A control that takes the keyboard focus moves the page here, so the
 * idle snap never has to move it.
 */
export function frameRestScreens(i: number): number {
  const k = Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(i)));
  if (k === 0) return LIST_FIRST_AT / 2;
  return turnAt(k) + TURN_SPAN + TURN_REST / 2;
}
