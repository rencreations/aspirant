import type { HomeSection } from "../../kernel/types";

import { preload } from "./preload";

/**
 * The chase and the comic, as two triggered scenes (`kernel/plays.ts`). `local` is the story's own
 * clock (`timeline.ts`), not the scroll: the first play runs the chase, from the empty page to
 * Tetra panting in the middle (about 2.4 s); the second runs the wave, the sit, the camera coming
 * in and the words (about 2 s) and rests on the comic. The scroll between the two thresholds is a
 * dwell. The words leave with the scroll after the section's end (`wordsLeave`). The first
 * play's `from` is the empty page, so the joint with the funny section holds; the last play's `to`
 * is `T.comic`, the frame the bend section starts from (`bend/joints.test.ts`). The first scene fires
 * after the funny section's tail has ended (0.8 screen), so its words are gone and the scroll is
 * not held while they are half way up; `plays.test.ts` holds it.
 */
export const section: HomeSection = {
  id: "chase",
  screens: 2.4,
  lead: 0.5,
  tail: 0.5,
  bg: "daybreak",
  nav: { theme: "daybreak" },
  // The words and the covers are all on from the second play: a focus on one lands in its dwell.
  focus: 0.85,
  dom: "fixed",
  plays: [
    { at: 0.375, from: 0, to: 0.46, seconds: 2.4, ease: "linear", back: 0.5 },
    { at: 0.667, from: 0.46, to: 0.9, seconds: 2, ease: "linear", back: 0.55 },
  ],
  preload,
  mount: async (ctx) => (await import("./runtime")).createRuntime(ctx),
};
