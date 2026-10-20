import type { Spot } from "../stage/hotspots";

export { HOTSPOT_PATHS, HOTSPOT_STEP } from "./hotspots.generated";

/**
 * The three touch points on her picture. Each one plays a short animation: the head of her
 * weapon, a spot beside her face (not on it) and her boot. The wording is plain on purpose: a
 * button says what it does.
 */
export const SPOTS: readonly Spot[] = [
  { id: "weapon", short: "short-3", label: "Weapon", action: "Play the weapon animation" },
  { id: "face", short: "short-1", label: "Her gaze", action: "Play the animation of her face" },
  { id: "feet", short: "short-2", label: "Her step", action: "Play the animation of her feet" },
];
