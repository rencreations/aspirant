/**
 * What the live backdrop shows behind the hand: the cool night aurora of the fall's rest until the
 * hand starts to rise, then a deep nebula (a galaxy in pink, violet and cyan) for the rest of the
 * hand's scene. The list takes the backdrop over where the frame arrives. A pure function of the
 * hand's beat, so the same `t` always gives the same picture.
 */
import { planBackdrop, type BackdropPlan } from "../bolt/backdrop-plan";
import { BEAT } from "../bolt/stations";

const GALAXY: readonly string[] = ["#ff9ad8", "#b59cff", "#5ce1ff", "#ffffff"];

/** The hand's beat from which the nebula is asked for: the rise has begun. */
export const NEBULA_FROM = 0.15;

/** Fill `plan` for the hand's beat `t`. */
export function planHandBackdrop(t: number, plan: BackdropPlan): BackdropPlan {
  if (t < NEBULA_FROM) return planBackdrop(BEAT.end, plan);
  const o = plan.options;
  plan.kind = "galaxy";
  o.colors = GALAXY;
  o.amount = 0.9;
  o.speed = 0.8;
  o.intensity = 1;
  return plan;
}
