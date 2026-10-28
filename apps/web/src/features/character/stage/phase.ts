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
 * True when the loop is too far from the frame a video starts at for the visitor to wait for it:
 * more than `maxWait` frames until the trigger frame. False when there is no limit (`maxWait`
 * missing), and the video waits for its frame.
 */
export function tooFar(
  current: number,
  triggers: readonly number[],
  maxWait: number | undefined,
  n: number,
): boolean {
  return maxWait !== undefined && waitFrames(current, triggers, n) > maxWait;
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

// Time skip -------------------------------------------------------------------------------------

/** The last stretch of the wait (in frames) is spent easing back to normal speed. */
const SKIP_RAMP_FRAMES = 90;
/** It takes this long to get up to speed. */
const SKIP_EASE_MS = 450;

const smooth = (t: number) => t * t * (3 - 2 * t);

/** How the picture is sped up while it waits for a frame (see the director's `skip` option). */
export interface SkipOptions {
  /** The fastest the picture runs, as a multiple of normal speed. */
  maxRate: number;
  /** A wait shorter than this many frames runs at normal speed. */
  minFrames: number;
}

/**
 * The speed of the picture while it waits for the frame it hands over on. It eases up to `maxRate`
 * in `SKIP_EASE_MS`, and eases back down over the last `SKIP_RAMP_FRAMES`, so the picture arrives
 * at normal speed and the dissolve that follows starts from a natural motion.
 */
export function skipRate(remaining: number, elapsedMs: number, maxRate: number): number {
  const out = smooth(Math.min(1, Math.max(0, remaining / SKIP_RAMP_FRAMES)));
  const into = smooth(Math.min(1, Math.max(0, elapsedMs / SKIP_EASE_MS)));
  return 1 + (maxRate - 1) * out * into;
}

/**
 * How long a wait of `frames` frames takes on the clock when it is sped up as `skipRate` says.
 * The page uses it for the length of the waiting animation, so the animation ends exactly when
 * the picture does.
 */
export function skipWallMs(frames: number, fps: number, skip: SkipOptions | null): number {
  if (!skip || frames <= skip.minFrames) return (frames / fps) * 1000;
  const dt = 16;
  let remaining = frames;
  let elapsed = 0;
  while (remaining > 0 && elapsed < 60_000) {
    remaining -= skipRate(remaining, elapsed, skip.maxRate) * fps * (dt / 1000);
    elapsed += dt;
  }
  return elapsed;
}
