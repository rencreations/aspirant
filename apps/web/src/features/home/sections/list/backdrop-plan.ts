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
    theme: "daybreak";
    colors: readonly string[];
    amount: number;
    speed: number;
    intensity: number;
  };
}

/** A soft cloth on the paper: the pastel stops carry the colour, so the amount stays modest. */
const AMOUNT = 0.62;

export function newListBackdrop(): ListBackdropPlan {
  return {
    kind: "silk",
    options: {
      theme: "daybreak",
      colors: FRAME_PALETTES[0]!,
      amount: AMOUNT,
      speed: 0.8,
      intensity: 1,
    },
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
  o.amount = AMOUNT;
  o.speed = 0.8 + 0.6 * growth;
  o.intensity = 1;
  return plan;
}
