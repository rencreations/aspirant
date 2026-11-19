/**
 * What the live backdrop shows through the bolt and the fall (round five, 20 Nov 2026, light mode
 * only): the strip's own ink field, a very soft pale blue mist that flows on the paper, at the level
 * and the strength the strip ends on (`INK_LEVEL` and `INK_INTENSITY` of `sections/backdrops.ts`), so
 * nothing changes hue or strength where the strip ends. As the visitor scrolls its amount thins out
 * (`mistLeft`), while the white rises from the bottom (`whiteRise` in `journey.ts`): the page
 * brightens from pale blue to near white. No aurora, no lightning, no speed lines: the kind never
 * changes. A pure function of `u`, the scroll in screens since the start of the bolt.
 */
import type { BackdropKind } from "../../fx/backdrop/palettes";
import { INK_INTENSITY, INK_LEVEL } from "../backdrops";

import { mistLeft } from "./journey";

export interface BackdropPlan {
  kind: BackdropKind;
  options: {
    theme: "daybreak";
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
  return {
    kind: "ink-field",
    options: { theme: "daybreak", amount: INK_LEVEL, intensity: INK_INTENSITY },
    on: true,
  };
}

/** Fill `plan` for the scroll `u`. */
export function planBackdrop(u: number, plan: BackdropPlan): BackdropPlan {
  plan.kind = "ink-field";
  plan.options.intensity = INK_INTENSITY;
  plan.options.amount = INK_LEVEL * mistLeft(u);
  plan.on = plan.options.amount > OFF_BELOW;
  return plan;
}
