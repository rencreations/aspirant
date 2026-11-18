/**
 * What the live backdrop shows behind the list: silk in the colours of the picture that stands in
 * the window. The colours follow the strip, so they turn as the frames turn (the backdrop eases
 * toward what is asked, a rate of seven a second). A pure function of the strip's index.
 */
import type { BackdropKind } from "../../fx/backdrop/palettes";

import { FRAME_PALETTES } from "./palettes";

export interface ListBackdropPlan {
  kind: BackdropKind;
  options: {
    theme: "storm";
    colors: readonly string[];
    amount: number;
    speed: number;
    intensity: number;
  };
}

export function newListBackdrop(): ListBackdropPlan {
  return {
    kind: "silk",
    options: { theme: "storm", colors: FRAME_PALETTES[0]!, amount: 0.6, speed: 0.8, intensity: 1 },
  };
}

/** Fill `plan` for the strip's index (0 to 9) and the growth of the last frame (0 to 1). */
export function planListBackdrop(
  index: number,
  growth: number,
  plan: ListBackdropPlan,
): ListBackdropPlan {
  const k = Math.min(FRAME_PALETTES.length - 1, Math.max(0, Math.round(index)));
  const o = plan.options;
  plan.kind = "silk";
  o.colors = FRAME_PALETTES[k]!;
  // Calm behind the pictures, a little livelier as the last frame opens into the screen.
  o.amount = 0.6;
  o.speed = 0.8 + 0.6 * growth;
  o.intensity = 1;
  return plan;
}
