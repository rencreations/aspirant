/**
 * What the live backdrop shows behind the hand: nothing after the fall's black (the bolt's blue has
 * faded out), then a deep nebula (a galaxy in pink, violet and cyan) rising from the hand's beat
 * `NEBULA_FROM` for the rest of the hand's scene. The list takes the backdrop over where the frame
 * arrives. A pure function of the hand's beat, so the same `t` always gives the same picture.
 */
import type { BackdropPlan } from "../bolt/backdrop-plan";

const GALAXY: readonly string[] = ["#ff9ad8", "#b59cff", "#5ce1ff", "#ffffff"];

/** The hand's beat from which the nebula is asked for: the rise has begun. */
export const NEBULA_FROM = 0.15;
/** The beats over which the nebula comes in. */
const NEBULA_IN = 0.35;

/** Fill `plan` for the hand's beat `t`. */
export function planHandBackdrop(t: number, plan: BackdropPlan): BackdropPlan {
  const o = plan.options;
  plan.kind = "galaxy";
  o.colors = GALAXY;
  o.speed = 0.8;
  o.intensity = 1;
  const k = Math.min(1, Math.max(0, (t - NEBULA_FROM) / NEBULA_IN));
  o.amount = 0.9 * k * k * (3 - 2 * k);
  plan.on = o.amount > 0.004;
  return plan;
}
