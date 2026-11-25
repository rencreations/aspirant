import { LOWER_PASSAGE_SPEED } from "../../kernel/speed";
import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import {
  FUNNY_FOCUS,
  FUNNY_LEAVE_SPEED,
  FUNNY_PASS_SPEED,
  FUNNY_SCREENS,
  FUNNY_ZONES,
} from "./stations";
import { GONE } from "./timeline";

/**
 * Tetra, the kite and the two drones, as three scroll zones (`stations.ts`). The tail is long
 * enough for the page to ride the duo and the words out of the screen (scroll linked).
 */
export const section: HomeSection = {
  id: "funny",
  screens: FUNNY_SCREENS,
  lead: 1,
  tail: 0.8,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  // The words are in at the last station (the last rest): a focus lands in the middle of it.
  focus: FUNNY_FOCUS,
  // The scene has a top speed, so a hard scroll cannot skip the dance, the dragon, the question or
  // the way the drones and the words leave (a probe: they went in two frames).
  topSpeed: [
    // The whole passage, from the music's way out to the chase, rests included (25 Nov 2026).
    { from: -1, to: FUNNY_SCREENS + 0.8, speed: LOWER_PASSAGE_SPEED },
    { from: 0, to: FUNNY_ZONES[FUNNY_ZONES.length - 1]!.to, speed: FUNNY_PASS_SPEED },
    { from: FUNNY_SCREENS, to: FUNNY_SCREENS + GONE, speed: FUNNY_LEAVE_SPEED },
  ],
  dom: "fixed",
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
