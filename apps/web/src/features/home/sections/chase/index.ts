import type { HomePlay } from "../../kernel/plays";
import { LOWER_PASSAGE_SPEED } from "../../kernel/speed";
import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";
import { RUN_ZONE, T, WORDS_LEAVE_SCREENS } from "./timeline";

/** The chase, the stop for breath and the seated comic are scrubbed in both directions. */
/** The section's length in screens, and where each zone stands in it (screens from the start). */
const CHASE_SCREENS = 4.8;
/** The top scene speeds of the run and of the comic, in screens a second. */
const CHASE_RUN_SPEED = 1;
const CHASE_COMIC_SPEED = 1.2;
export const CHASE_ZONES = {
  run: RUN_ZONE,
  comic: { at: 2.12, len: 2.24 },
} as const;

const CHASE_PLAYS: readonly HomePlay[] = [
  {
    at: CHASE_ZONES.run.at / CHASE_SCREENS,
    span: CHASE_ZONES.run.len / CHASE_SCREENS,
    from: 0,
    to: T.tetraTo,
    // The scroll alone plays the zone, at a top speed (`topSpeed`): nothing finishes it by itself, so the
    // page never runs faster than the speed (25 Nov 2026).
    seconds: CHASE_ZONES.run.len / CHASE_RUN_SPEED,
    ease: "linear",
    noSnap: true,
  },
  {
    at: CHASE_ZONES.comic.at / CHASE_SCREENS,
    span: CHASE_ZONES.comic.len / CHASE_SCREENS,
    from: T.tetraTo,
    to: T.comic,
    seconds: CHASE_ZONES.comic.len / CHASE_COMIC_SPEED,
    ease: "linear",
    noSnap: true,
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
  // A top scene speed (25 Nov 2026, screens a second): the run, the stop for breath and the seated
  // comic play whole whatever the visitor does, and the words go in about a third of a second.
  topSpeed: [
    // The whole passage, rests included (25 Nov 2026): the run, the breath, the comic and the words.
    { from: -0.5, to: CHASE_SCREENS + 0.5, speed: LOWER_PASSAGE_SPEED },
    {
      from: CHASE_ZONES.run.at,
      to: CHASE_ZONES.run.at + CHASE_ZONES.run.len,
      speed: CHASE_RUN_SPEED,
    },
    {
      from: CHASE_ZONES.comic.at,
      to: CHASE_ZONES.comic.at + CHASE_ZONES.comic.len,
      speed: CHASE_COMIC_SPEED,
    },
    { from: CHASE_SCREENS, to: CHASE_SCREENS + WORDS_LEAVE_SCREENS, speed: CHASE_COMIC_SPEED },
  ],
  dom: "fixed",
  manualScroll: true,
  plays: CHASE_PLAYS,
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
