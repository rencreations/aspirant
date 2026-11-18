/**
 * The mood sequencer: a timeline of faces as a pure function. A section scripts "fear, then a
 * scream, then dizzy" as a list of steps and asks for the face at time `t` (the section's own
 * clock or its scroll), and gets the two expressions to blend and the weight between them. The
 * actor draws that blend (`DollActor.mood`), with the glyph swap hidden behind a blink.
 *
 * Step 0 is shown from t = 0. Every later step first blends from the one before it for `blend`
 * seconds (0 is a cut), then holds for `hold` seconds. Before 0 the first face holds, after the
 * end the last one does.
 */
import { smoothstep } from "../motion";

import type { FaceName } from "./presets";

export interface MoodStep {
  readonly face: FaceName;
  /** Seconds the face is shown in full. */
  readonly hold: number;
  /** Seconds it takes to arrive from the step before. Ignored on the first step. Default 0.12. */
  readonly blend?: number;
}

/** Two expressions and how far from the first to the second. At weight 0 or 1 `a` and `b` may be the same. */
export interface FaceMix {
  readonly a: FaceName;
  readonly b: FaceName;
  readonly w: number;
}

export const DEFAULT_BLEND = 0.12;

/** The length of the whole timeline in seconds. */
export function moodDuration(steps: readonly MoodStep[]): number {
  let total = 0;
  steps.forEach((s, i) => {
    total += Math.max(0, s.hold) + (i > 0 ? Math.max(0, s.blend ?? DEFAULT_BLEND) : 0);
  });
  return total;
}

/** The face at time `t`. An empty list is the neutral face. */
export function moodAt(
  steps: readonly MoodStep[],
  t: number,
  out: { a: FaceName; b: FaceName; w: number } = { a: "neutral", b: "neutral", w: 0 },
): { a: FaceName; b: FaceName; w: number } {
  const set = (a: FaceName, b: FaceName, w: number): typeof out => {
    out.a = a;
    out.b = b;
    out.w = w;
    return out;
  };
  if (steps.length === 0) return set("neutral", "neutral", 0);
  let start = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step) continue;
    const blend = i > 0 ? Math.max(0, step.blend ?? DEFAULT_BLEND) : 0;
    const hold = Math.max(0, step.hold);
    const end = start + blend + hold;
    if (t < end || i === steps.length - 1) {
      if (i > 0 && t < start + blend) {
        const w = blend > 0 ? smoothstep((t - start) / blend) : 1;
        return set(steps[i - 1]?.face ?? step.face, step.face, w);
      }
      return set(step.face, step.face, 0);
    }
    start = end;
  }
  const last = steps[steps.length - 1]?.face ?? "neutral";
  return set(last, last, 0);
}

/** The same blend as weights over the expressions: what a reader that wants "the preset weights" asks for. */
export function moodWeights(mix: FaceMix): Partial<Record<FaceName, number>> {
  if (mix.a === mix.b) return { [mix.a]: 1 };
  return { [mix.a]: 1 - mix.w, [mix.b]: mix.w };
}
