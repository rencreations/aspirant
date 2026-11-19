/**
 * The wind of the descent: a fixed scatter of streaks and dots (no randomness at runtime, the same on
 * every load and in the server markup). `speed` is how many screens each moves up for one screen of
 * scroll: more than one, so the page seems to fall past the pair. Pure.
 */
export interface Streak {
  /** Left edge, percent of the width. */
  readonly x: number;
  /** Length of a streak, the width of a dot or of a cloud, in CSS pixels. */
  readonly size: number;
  readonly kind: "streak" | "dot" | "cloud";
  /** Screens up per screen of scroll. */
  readonly speed: number;
  /** Where it starts, as a share of its wrap length, 0 to 1. */
  readonly phase: number;
  /** The most opaque it gets, 0 to 1. */
  readonly alpha: number;
}

/** A small deterministic hash to 0..1, so the scatter is fixed. */
const hash = (n: number, salt: number): number => {
  let h = Math.imul(n + 1 + salt * 977, 2654435761) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return (h % 10000) / 10000;
};

const STREAK_COUNT = 32;

export const STREAKS: readonly Streak[] = Array.from({ length: STREAK_COUNT }, (_, i): Streak => {
  // Every fifth is a soft cloud, every fourth a dot, the rest are streaks.
  const kind = i % 5 === 4 ? "cloud" : i % 4 === 3 ? "dot" : "streak";
  const far = hash(i, 3);
  return {
    // Spread over the width.
    x: kind === "cloud" ? -6 + hash(i, 1) * 100 : 3 + hash(i, 1) * 94,
    size:
      kind === "cloud"
        ? 260 + Math.round(far * 220)
        : kind === "dot"
          ? 4 + Math.round(far * 7)
          : 50 + Math.round(far * 130),
    kind,
    // Near things (long streaks) rush faster than the far ones; the clouds drift past slower.
    speed: kind === "cloud" ? 1.25 + far * 0.4 : kind === "dot" ? 1.2 + far * 0.6 : 1.6 + far * 1.5,
    phase: hash(i, 2),
    alpha:
      kind === "cloud" ? 0.5 + far * 0.3 : kind === "dot" ? 0.5 + far * 0.25 : 0.3 + far * 0.25,
  };
});
