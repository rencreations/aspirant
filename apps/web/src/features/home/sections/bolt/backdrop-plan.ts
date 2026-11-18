/**
 * What the live backdrop shows behind the bolt and the fall, as a pure function of beat time. Both
 * sections ask for it (the later one wins where they overlap), so the two must agree: the same `t`
 * gives the same kind and numbers, and every station rests on a kind of its own.
 *
 *   before 3.45   a green aurora in the dark (it rises in the section's lead)
 *   3.45 to 4.3   lightning: the dragon is frightened, sneezes, the doll is thrown
 *   4.3 to 6.2    speed lines: the fall
 *   from 6.2      a cool night aurora: the doll hangs and "10 Characters" stands
 *
 * A change of kind cross-fades by itself (half a second of the clock, not of the scroll).
 */
import type { BackdropKind } from "../../fx/backdrop/palettes";

import { BEAT } from "./stations";

export interface BackdropPlan {
  kind: BackdropKind;
  options: {
    theme: "storm";
    colors: readonly string[];
    amount: number;
    speed: number;
    intensity: number;
  };
}

const MINT: readonly string[] = ["#1fe6a8", "#0a7a5a", "#7af5d3"];
const STRIKE: readonly string[] = ["#9ff5e0", "#5ce1ff", "#ffffff"];
const STREAKS: readonly string[] = ["#ffffff", "#8fe6ff", "#ff8fd0"];
const NIGHT: readonly string[] = ["#4f6bff", "#a98bff", "#4fd8ff"];

/** Where the kind changes. They are away from the stations, so no station rests on a seam. */
export const BACKDROP_AT = { strike: 3.45, streaks: 4.3, night: 6.2 } as const;

const smooth = (v: number): number => {
  const x = Math.min(1, Math.max(0, v));
  return x * x * (3 - 2 * x);
};

export function newBackdropPlan(): BackdropPlan {
  return {
    kind: "aurora",
    options: { theme: "storm", colors: MINT, amount: 0, speed: 1, intensity: 1 },
  };
}

/** Fill `plan` for beat time `t`. */
export function planBackdrop(t: number, plan: BackdropPlan): BackdropPlan {
  const o = plan.options;
  o.speed = 1;
  o.intensity = 1;
  if (t < BACKDROP_AT.strike) {
    plan.kind = "aurora";
    o.colors = MINT;
    // It rises in the lead (t from -0.5), and is whole when the dragon comes.
    o.amount = 0.85 * smooth((t + 0.5) / 0.8);
    o.speed = 0.8 + 0.5 * smooth((t - BEAT.enter) / 1.1) * (1 - smooth((t - 1.3) / 0.4));
  } else if (t < BACKDROP_AT.streaks) {
    plan.kind = "lightning";
    o.colors = STRIKE;
    o.amount = 0.9;
  } else if (t < BACKDROP_AT.night) {
    plan.kind = "speed-lines";
    o.colors = STREAKS;
    o.amount = 0.85;
    // The streaks run fastest in the middle of the fall and slow as she settles.
    o.speed = 2.2 * smooth((t - BACKDROP_AT.streaks) / 0.5) * (1 - 0.6 * smooth((t - 5.6) / 0.6));
  } else {
    plan.kind = "aurora";
    o.colors = NIGHT;
    o.amount = 0.8;
  }
  return plan;
}
