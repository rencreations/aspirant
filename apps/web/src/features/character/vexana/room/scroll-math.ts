/**
 * The scroll at the foot of the room. The room is the last section: its screen stays put while the
 * page scrolls through a tall track, and how far along the track the visitor is (`progress`, from 0
 * to 1) runs two meters:
 *
 *   0 to DEAD       nothing happens (a quiet stretch, the visitor is only looking)
 *   DEAD to BAR_AT  the strength meter at the side rises, and when it is full the information bar
 *                   about the next character slides up
 *   BAR_AT to ARM_AT   the meter in the bar fills, and when it is full the page goes on
 */
export const DEAD = 0.1;
export const BAR_AT = 0.5;
export const ARM_AT = 0.98;
/** Below this the page does not go on (scrolling back up cancels the countdown). */
export const CANCEL_BELOW = 0.94;
/** The bar slides away again once the visitor has scrolled back this far. */
const BAR_CLOSE_AT = BAR_AT - 0.06;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** How far along a tall track the visitor is: the track's top and height, and the screen's height. */
export function trackProgress(top: number, height: number, viewport: number): number {
  const travel = height - viewport;
  return travel > 0 ? clamp01(-top / travel) : 0;
}

export interface Meters {
  /** The strength meter at the side, 0 to 1. */
  strength: number;
  /** The meter in the information bar, 0 to 1. */
  ahead: number;
  /** The information bar is up. */
  bar: boolean;
  /** Full: the page goes on. */
  armed: boolean;
}

/** The meters at a progress. `barWas` is whether the bar was up, so it does not flicker at the edge. */
export function meters(progress: number, barWas = false): Meters {
  const strength = clamp01((progress - DEAD) / (BAR_AT - DEAD));
  const bar = barWas ? progress >= BAR_CLOSE_AT : progress >= BAR_AT;
  const ahead = bar ? clamp01((progress - BAR_AT) / (ARM_AT - BAR_AT)) : 0;
  return { strength, ahead, bar, armed: progress >= ARM_AT };
}

/** How long after the visitor's last scroll input the page may still go on by itself. */
const INPUT_WINDOW_MS = 5000;

/**
 * Whether the visitor has scrolled (wheel, touch, key or pointer) recently enough for the end of the
 * track to count as theirs. Without this, a page opened with the previous page's scroll position
 * (the curtain is still up) reads as "the end was reached" and goes on by itself, again and again.
 */
export function recentInput(now: number, lastInput: number, windowMs = INPUT_WINDOW_MS): boolean {
  return now - lastInput <= windowMs;
}
