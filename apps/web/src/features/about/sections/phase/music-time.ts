/**
 * The arithmetic of the music decks: how a length is written, how far a track has played, and
 * what the ring around a disc does with it. Plain numbers, so it can be tested.
 */

/** A length as the page writes it: 308.48 gives `5:08`. */
export function clock(seconds: number): string {
  const s = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The time that has run, which never shows a second that has not been heard yet: 59.9 is `0:59`. */
export function elapsed(seconds: number): string {
  return clock(Number.isFinite(seconds) ? Math.floor(Math.max(0, seconds)) : 0);
}

/** The share of a track that has played, 0 to 1. A length that is not known yet gives 0. */
export function progressOf(time: number, duration: number): number {
  if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(1, Math.max(0, time / duration));
}

/**
 * The length to trust: the one the audio file reports once it is known, and the one of the record
 * until then (a stream reports `Infinity` or `NaN` before its first bytes).
 */
export function lengthOf(reported: number, recorded: number): number {
  return Number.isFinite(reported) && reported > 0 ? reported : recorded;
}

/**
 * The ring is two half rings, each behind a window half the disc wide, and they turn by transform
 * only. The first is a left half ring behind the right window: turned clockwise it comes into
 * view from the top and has filled the right half when half of the track has played. The second
 * is a right half ring behind the left window and does the same for the rest of the track. These
 * are their angles, in degrees, for a share of the track.
 */
export function ringAngles(progress: number): { first: number; second: number } {
  const p = Math.min(1, Math.max(0, progress));
  return {
    first: Math.min(1, p * 2) * 180,
    second: Math.max(0, p * 2 - 1) * 180,
  };
}

const turn = (degrees: number, offset: number): Keyframe => ({
  transform: `rotate(${degrees}deg)`,
  offset,
});

/** The same sweep as keyframes over the whole track, for the two halves and for the head. */
export const RING_FRAMES: Readonly<Record<"first" | "second" | "head", Keyframe[]>> = {
  first: [0, 0.5, 1].map((at) => turn(ringAngles(at).first, at)),
  second: [0, 0.5, 1].map((at) => turn(ringAngles(at).second, at)),
  head: [turn(0, 0), turn(360, 1)],
};

/**
 * Should the ring be set to the track's time again? The ring runs by itself on the compositor
 * while the track plays, so it is only corrected when the two have come apart (a seek, a stall).
 */
export function drifted(ringMs: number, trackMs: number, toleranceMs = 180): boolean {
  return Math.abs(ringMs - trackMs) > toleranceMs;
}
