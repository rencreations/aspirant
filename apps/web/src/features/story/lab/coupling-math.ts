import { clamp } from "@/lib/math";

/** The top of the lab's dial. The story's highest score is 2.1. */
export const MAX_SCORE = 2.5;

/** Scores at which the Emblem of Hope stars wake, link and merge. The lab's own thresholds. */
const THRESHOLDS = { wake: 0.8, link: 1.62, merge: 2.1 } as const;

const CURVE = 1.6;

/** Coupling reading for how close the crystals are (0 apart, 1 touching). A toy curve. */
export function scoreOf(closeness: number): number {
  return MAX_SCORE * Math.pow(clamp(closeness), CURVE);
}

/** How close the crystals must be to read `score`. The inverse of `scoreOf`. */
export function closenessFor(score: number): number {
  return Math.pow(clamp(score / MAX_SCORE), 1 / CURVE);
}

/** 0 apart, 1 the stars wake, 2 they link, 3 they merge into one. */
export function stageOf(score: number): 0 | 1 | 2 | 3 {
  if (score >= THRESHOLDS.merge - 0.0001) return 3;
  if (score >= THRESHOLDS.link - 0.0001) return 2;
  if (score >= THRESHOLDS.wake) return 1;
  return 0;
}
