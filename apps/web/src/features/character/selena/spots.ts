import type { Spot } from "../stage/hotspots";

export { HOTSPOT_PATHS, HOTSPOT_STEP } from "./hotspots.generated";

/**
 * The three touch points on her picture. Each one plays a short animation. The wording is plain
 * on purpose: a button says what it does.
 */
export const SPOTS: readonly Spot[] = [
  {
    id: "silverbolt",
    short: "short-1",
    label: "Silverbolt",
    action: "Play the Silverbolt animation",
  },
  { id: "badge", short: "short-2", label: "Badge", action: "Play the badge animation" },
  { id: "hand", short: "short-3", label: "Right arm", action: "Play the right arm animation" },
];
