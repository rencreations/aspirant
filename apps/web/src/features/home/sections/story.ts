/**
 * The story axis of the first four sections (round two, 19 Nov 2026).
 *
 * The beats of the hero, the aspirants, the rows and the strip, the drone's route and the film's state
 * are written in "story screens": the unit they had when these scenes followed the scroll. A visitor
 * no longer scrolls that far. A section on plays (`kernel/plays.ts`) runs a virtual `local` on a clock,
 * and `update` turns it into story screens with the numbers below. The registry's `screens` is the
 * scroll the visitor spends (the dwell between two triggers) and has nothing to do with these.
 *
 * Pure: no imports. A module that a section's `index.ts` imports must not import `kernel/where.ts`.
 */

/** Where each section starts on the story axis and how long its story is. */
export const STORY = {
  /** The logo, the cards, the ring, the land: the hero's play ends on the wall with the words in. */
  hero: { start: 0, length: 4.5 },
  /** The wall's last part: the words fold and the wall opens into the full screen rows. */
  aspirants: { start: 4.5, length: 0.8 },
  /** The rows slide, the film appears, the clearing, the film turns upright. */
  rows: { start: 5.3, length: 2.4 },
  /** The strip: its words, the window, the orbit of the ten films, the fly-off. */
  strip: { start: 7.7, length: 3.1 },
} as const;

export type StoryId = keyof typeof STORY;

/** The story position (screens) of a section's own story position `s` (screens from its start). */
export const storyAt = (id: StoryId, s: number): number => STORY[id].start + s;

/** Where the story of a section ends. */
export const storyEnd = (id: StoryId): number => STORY[id].start + STORY[id].length;
