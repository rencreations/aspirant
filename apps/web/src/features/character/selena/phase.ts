import { SELENA_FPS, SELENA_LOOP_FRAMES } from "./timeline.generated";

/**
 * Frame maths for the loops. The idle loop is 486 frames long, the page loops 240 or 486. A video
 * can only start while the loop on screen shows the frame it was cut from, so the director waits
 * for that frame. The video starts playing `LEAD_FRAMES` early because a paused video needs a
 * moment to show its first frame after `play()`. Every function takes the loop length `n`.
 */
export const LEAD_FRAMES = 3;

export const wrapFrame = (frame: number, n = SELENA_LOOP_FRAMES): number => ((frame % n) + n) % n;

/** The loop frame a media time falls on. */
export function frameAt(seconds: number, n = SELENA_LOOP_FRAMES): number {
  return wrapFrame(Math.floor(seconds * SELENA_FPS + 0.5), n);
}

/** Frames from `from` forward to `to`, 0 to n - 1. */
export function framesUntil(from: number, to: number, n = SELENA_LOOP_FRAMES): number {
  return wrapFrame(to - from, n);
}

/** The frames at which a video must be started so it lands on its start phases. */
export function triggerFrames(
  startPhases: readonly number[],
  n = SELENA_LOOP_FRAMES,
  lead = LEAD_FRAMES,
): number[] {
  return startPhases.map((p) => wrapFrame(p - lead, n));
}

/**
 * True when the loop moved from `prev` to `cur` (frames can be skipped on a slow screen) and
 * passed one of the trigger frames on the way. `cur` counts, `prev` does not.
 */
export function crossed(
  prev: number,
  cur: number,
  triggers: readonly number[],
  n = SELENA_LOOP_FRAMES,
): boolean {
  const advance = framesUntil(prev, cur, n);
  if (advance === 0 || advance > n / 2) return false;
  return triggers.some((t) => {
    const d = framesUntil(prev, t, n);
    return d > 0 && d <= advance;
  });
}

/** How many frames until the next trigger. 0 means now. */
export function waitFrames(
  current: number,
  triggers: readonly number[],
  n = SELENA_LOOP_FRAMES,
): number {
  return Math.min(...triggers.map((t) => framesUntil(current, t, n)));
}
