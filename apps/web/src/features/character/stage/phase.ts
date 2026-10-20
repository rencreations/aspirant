/**
 * Frame maths for the loops. A video can only start while the loop on screen shows the frame it
 * was cut from, so the director waits for that frame. The video starts playing `LEAD_FRAMES` early
 * because a paused video needs a moment to show its first frame after `play()`. Every function
 * takes the loop length `n` (the idle loop is 482 or 486 frames, a page loop 180 to 486).
 */
export const LEAD_FRAMES = 3;

export const wrapFrame = (frame: number, n: number): number => ((frame % n) + n) % n;

/** The loop frame a media time falls on, for a video of `fps` frames a second. */
export function frameAt(seconds: number, n: number, fps: number): number {
  return wrapFrame(Math.floor(seconds * fps + 0.5), n);
}

/** Frames from `from` forward to `to`, 0 to n - 1. */
export function framesUntil(from: number, to: number, n: number): number {
  return wrapFrame(to - from, n);
}

/** The frames at which a video must be started so it lands on its start phases. */
export function triggerFrames(
  startPhases: readonly number[],
  n: number,
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
  n: number,
): boolean {
  const advance = framesUntil(prev, cur, n);
  if (advance === 0 || advance > n / 2) return false;
  return triggers.some((t) => {
    const d = framesUntil(prev, t, n);
    return d > 0 && d <= advance;
  });
}

/** How many frames until the next trigger. 0 means now. */
export function waitFrames(current: number, triggers: readonly number[], n: number): number {
  return Math.min(...triggers.map((t) => framesUntil(current, t, n)));
}
