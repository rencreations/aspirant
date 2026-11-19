import type { HomePlay } from "../../kernel/plays";
import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { T } from "./timeline";

/**
 * The chase and the comic, as two scroll zones (`kernel/scrub.ts`). `local` is the story's own clock
 * (`timeline.ts`), not the scroll: the first zone runs the chase, from the empty page to Tetra
 * panting in the middle; the second runs the wave, the sit, the camera coming in and the words and
 * rests on the comic. The visitor scrolls for the scene to play, up or down, and the page finishes a
 * zone by itself when they stop inside it. Between the zones is a short rest (Tetra panting) and after
 * the second a longer one (the comic and its two buttons). The words leave with the scroll after the
 * section's end (`wordsLeave`). The first zone's `from` is the empty page, so the joint with the funny
 * section holds; the last zone's `to` is `T.comic`, the frame the bend section starts from
 * (`bend/joints.test.ts`). The first zone starts after the funny section's tail has ended (0.8 screen),
 * so its words are gone before the doll runs; `plays.test.ts` holds it.
 */

/** The section's length in screens, and where each zone stands in it (screens from the start). */
export const CHASE_SCREENS = 4.1;
export const CHASE_ZONES = {
  run: { at: 0.85, len: 1.1 },
  comic: { at: 2.2, len: 1 },
} as const;

/** The seconds the page takes to finish a whole zone by itself when the visitor stops inside it. */
const SNAP_SECONDS = 0.9;

export const CHASE_PLAYS: readonly HomePlay[] = [
  {
    at: CHASE_ZONES.run.at / CHASE_SCREENS,
    span: CHASE_ZONES.run.len / CHASE_SCREENS,
    from: 0,
    to: T.tetraTo,
    seconds: SNAP_SECONDS,
    ease: "linear",
  },
  {
    at: CHASE_ZONES.comic.at / CHASE_SCREENS,
    span: CHASE_ZONES.comic.len / CHASE_SCREENS,
    from: T.tetraTo,
    to: T.comic,
    seconds: SNAP_SECONDS,
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
  focus: 0.85,
  dom: "fixed",
  plays: CHASE_PLAYS,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
