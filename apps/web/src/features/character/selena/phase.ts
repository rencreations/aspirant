import { SELENA_FPS, SELENA_LOOP_FRAMES } from "./timeline.generated";

/**
 * Frame maths for the idle loop. The loop is 486 frames long. A clip can only start while the
 * loop shows the frame its first frame was cut from, so the director waits for that frame. The
 * clip starts playing `LEAD_FRAMES` early because a paused video needs a moment to show its first
 * frame after `play()`.
 */
export const LEAD_FRAMES = 3;

const N = SELENA_LOOP_FRAMES;

export const wrapFrame = (frame: number): number => ((frame % N) + N) % N;

/** The loop frame a media time falls on. */
export function frameAt(seconds: number): number {
  return wrapFrame(Math.floor(seconds * SELENA_FPS + 0.5));
}

/** Frames from `from` forward to `to`, 0 to N - 1. */
export function framesUntil(from: number, to: number): number {
  return wrapFrame(to - from);
}

/** The frames at which a clip must be started so it lands on its start phases. */
export function triggerFrames(startPhases: readonly number[], lead = LEAD_FRAMES): number[] {
  return startPhases.map((p) => wrapFrame(p - lead));
}

/**
 * True when the loop moved from `prev` to `cur` (frames can be skipped on a slow screen) and
 * passed one of the trigger frames on the way. `cur` counts, `prev` does not.
 */
export function crossed(prev: number, cur: number, triggers: readonly number[]): boolean {
  const advance = framesUntil(prev, cur);
  if (advance === 0 || advance > N / 2) return false;
  return triggers.some((t) => {
    const d = framesUntil(prev, t);
    return d > 0 && d <= advance;
  });
}

/** How many frames until the next trigger. 0 means now. */
export function waitFrames(current: number, triggers: readonly number[]): number {
  return Math.min(...triggers.map((t) => framesUntil(current, t)));
}
