/**
 * What the live backdrop shows behind the hand (round five, light mode only): nothing after the fall's
 * white (the bolt's pale blue mist has thinned out), then a soft pastel aurora in the daybreak colours
 * (pale sky, lilac, blush and cream) rising from the hand's beat `NEBULA_FROM` for the rest of the
 * hand's scene, so the black glove stands out of a calm, bright ground. The list takes the backdrop
 * over where the frame arrives. A pure function of the hand's beat, so the same `t` always gives the
 * same picture.
 */
import type { BackdropPlan } from "../bolt/backdrop-plan";

/** The hand's beat from which the aurora is asked for: the rise has begun. */
export const NEBULA_FROM = 0.15;
/** The beats over which the aurora comes in. */
const NEBULA_IN = 0.35;
/** How much of it stands at the end: a pale wash, never a colour that competes with the words. */
const NEBULA_AMOUNT = 0.55;

/** Fill `plan` for the hand's beat `t`. */
export function planHandBackdrop(t: number, plan: BackdropPlan): BackdropPlan {
  const o = plan.options;
  plan.kind = "soft-aurora";
  o.colors = undefined;
  o.speed = 0.7;
  o.intensity = 1;
  const k = Math.min(1, Math.max(0, (t - NEBULA_FROM) / NEBULA_IN));
  o.amount = NEBULA_AMOUNT * k * k * (3 - 2 * k);
  plan.on = o.amount > 0.004;
  return plan;
}
