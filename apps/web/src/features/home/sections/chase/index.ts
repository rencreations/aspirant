import type { HomePlay } from "../../kernel/plays";
import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { T } from "./timeline";

/** The chase, the stop for breath and the seated comic are scrubbed in both directions. */
/** The section's length in screens, and where each zone stands in it (screens from the start). */
const CHASE_SCREENS = 4.8;
export const CHASE_ZONES = {
  run: { at: 0.85, len: 1.1 },
  comic: { at: 2.12, len: 2.24 },
} as const;

const CHASE_PLAYS: readonly HomePlay[] = [
  {
    at: CHASE_ZONES.run.at / CHASE_SCREENS,
    span: CHASE_ZONES.run.len / CHASE_SCREENS,
    from: 0,
    to: T.tetraTo,
    seconds: 0.9,
    ease: "linear",
  },
  {
    at: CHASE_ZONES.comic.at / CHASE_SCREENS,
    span: CHASE_ZONES.comic.len / CHASE_SCREENS,
    from: T.tetraTo,
    to: T.comic,
    seconds: 0.9,
    ease: "linear",
  },
];

export const section: HomeSection = {
  id: "chase",
  screens: CHASE_SCREENS,
  lead: 0.5,
  tail: 0.5,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  // The words and the covers are all on from the second zone's end: a focus on one lands in the dwell.
  focus: 0.94,
  dom: "fixed",
  manualScroll: true,
  plays: CHASE_PLAYS,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
