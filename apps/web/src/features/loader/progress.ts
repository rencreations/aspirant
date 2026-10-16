import { FORM_START } from "./constants";

export interface ProgressInput {
  /** Loading tasks finished so far. */
  done: number;
  /** All loading tasks. */
  total: number;
  /** Time since loading started. */
  elapsedMs: number;
  /** Time since the last task finished (or since the start). */
  sinceLastMs: number;
  minDurationMs: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Where the counter is heading. Real task completion is the ceiling, with a small creep
 * toward the next task so a slow file never freezes the readout, and the elapsed share of
 * the minimum duration is a second ceiling so the morph always has time to play.
 */
export function targetProgress({
  done,
  total,
  elapsedMs,
  sinceLastMs,
  minDurationMs,
}: ProgressInput): number {
  const real = total <= 0 ? 1 : clamp01(done / total);
  const creep =
    total > 0 && done < total ? (0.85 / total) * (1 - Math.exp(-sinceLastMs / 1800)) : 0;
  const time = minDurationMs <= 0 ? 1 : clamp01(elapsedMs / minDurationMs);
  return Math.min(clamp01(real + creep), time);
}

/**
 * Eases the displayed value toward the target. Never moves backwards and snaps the last
 * fraction of a percent so the readout lands on exactly 100.
 */
export function stepProgress(current: number, target: number, dtMs: number): number {
  if (target <= current) return current;
  const k = 1 - Math.exp(-Math.max(0, dtMs) / 220);
  const next = current + (target - current) * k;
  return target - next < 0.002 ? target : next;
}

/** Index into the status lines for a progress value. */
export function statusIndex(progress: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.floor(clamp01(progress) * count));
}

/** How far the field has condensed toward the wordmark (0 to 1) for a progress value. */
export function formAmount(progress: number): number {
  const t = clamp01((progress - FORM_START) / (1 - FORM_START));
  return t * t * (3 - 2 * t);
}
