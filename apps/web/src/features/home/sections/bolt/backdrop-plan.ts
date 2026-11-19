/**
 * What the live backdrop shows through the bolt and the fall (round four, 20 Nov 2026): the strip's own
 * blue ink field, the same kind with the same colours, so nothing changes hue where the strip ends.
 * As the visitor scrolls its amount fades to black (nothing but the storm ground is left), while the
 * white rises from the bottom (`whiteRise` in `journey.ts`). No aurora, no lightning, no speed lines:
 * the kind never changes. A pure function of `u`, the scroll in screens since the start of the bolt.
 */
import type { BackdropKind } from "../../fx/backdrop/palettes";

import { backdropAmount } from "./journey";

export interface BackdropPlan {
  kind: BackdropKind;
  options: {
    theme: "storm";
    amount: number;
    colors?: readonly string[];
    speed?: number;
    intensity?: number;
  };
  /** False once it has faded to nothing: the section stops asking and the backdrop costs nothing. */
  on: boolean;
}

/** Below this amount the backdrop is not drawn at all. */
const OFF_BELOW = 0.004;

export function newBackdropPlan(): BackdropPlan {
  return { kind: "ink-field", options: { theme: "storm", amount: 0.9 }, on: true };
}

/** Fill `plan` for the scroll `u`. */
export function planBackdrop(u: number, plan: BackdropPlan): BackdropPlan {
  plan.kind = "ink-field";
  plan.options.amount = backdropAmount(u);
  plan.on = plan.options.amount > OFF_BELOW;
  return plan;
}
