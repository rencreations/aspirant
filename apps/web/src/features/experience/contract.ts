/**
 * The contract between the Experience reader (`reader/`) and the scene library (`scenes/`).
 *
 * The reader owns scrolling and text. It writes the active position into `useExperience`.
 * The scenes read it and render the fixed backdrop and the inline set pieces.
 * Neither side imports the other's internals; they meet only here.
 */
import { create } from "zustand";

/** Part numbers One to Twelve. */
export type PartNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** Which of the two worlds a moment belongs to. Drives the theme and the scene palette. */
export type Mood = "daybreak" | "storm";

export interface ExperienceState {
  /** Part currently under the reading line. `null` before the first Part is reached. */
  readonly partNumber: PartNumber | null;
  /** Chapter id such as `c05`, or an interlude id such as `i-far-above-1`. */
  readonly chapterId: string | null;
  /** Progress through the active chapter, 0 to 1. */
  readonly chapterProgress: number;
  /** Id of the paragraph that is lit, such as `c05-p012`. */
  readonly paragraphId: string | null;
  /** Progress through the whole story, 0 to 1. */
  readonly storyProgress: number;
  /** Raised to 1 for a moment when a key line lands, then decays. Scenes can pulse on it. */
  readonly beat: number;
  setPosition: (
    p: Partial<
      Pick<
        ExperienceState,
        "partNumber" | "chapterId" | "chapterProgress" | "paragraphId" | "storyProgress"
      >
    >,
  ) => void;
  pulse: () => void;
}

export const useExperience = create<ExperienceState>()((set) => ({
  partNumber: null,
  chapterId: null,
  chapterProgress: 0,
  paragraphId: null,
  storyProgress: 0,
  beat: 0,
  setPosition: (p) => {
    set(p);
  },
  pulse: () => {
    set({ beat: 1 });
  },
}));

/** Props every inline set piece receives. */
export interface SetPieceProps {
  /** True while the piece is on screen. Pause work when false. */
  readonly active: boolean;
  /** Reduced motion: render a calm static version that is still operable. */
  readonly reduced: boolean;
  /** Chapter the piece belongs to. */
  readonly chapterId: string;
}

/**
 * Where an inline set piece sits in the text.
 * `after` is a paragraph id (`c01-p010`); the reader renders the piece right after it.
 * The scene engineer owns this list and the registry in `scenes/setpieces/index.ts`.
 */
export interface SetPieceAnchor {
  readonly id: string;
  readonly chapterId: string;
  readonly after: string;
  /** Short visible caption, our copy, no dashes. */
  readonly caption: string;
  /** Accessible description of what it does and how to operate it. */
  readonly label: string;
}
