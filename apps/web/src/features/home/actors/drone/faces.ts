/**
 * Every face the normal drone can wear: the nine of the About page (the model's own picture, page
 * S) and the eighteen of `scripts/home/drone/faces.cjs` (two more pages, A and B, in the same 3 by 3
 * layout). The table is written here and a test keeps it equal to `public/img/home/drone-faces.json`.
 * No three here.
 *
 * A drawing cannot be blended with another, so a change is hidden behind a quick blink (`face-state.ts`).
 * What can be blended is the drone's body language, which goes with the face (`MOODS`): fins up
 * for joy, wings wide for a fright, everything hanging for sorrow.
 */

const BASE_FACES = [
  "normal",
  "angry",
  "squint",
  "happy",
  "dead",
  "scan",
  "ecg",
  "sleepy",
  "alert",
] as const;

const EXTRA_FACES = [
  "shocked",
  "confused",
  "thanks",
  "sweat",
  "exclaim",
  "question",
  "sparkle",
  "sad",
  "dizzy",
  "proud",
  "cry",
  "heart",
  "smug",
  "wink",
  "dots",
  "music",
  "determined",
  "laugh",
] as const;

type BaseFace = (typeof BASE_FACES)[number];
type ExtraFace = (typeof EXTRA_FACES)[number];
export type FaceName = BaseFace | ExtraFace;

/** The three pictures of faces: the model's own (S) and the two the home adds. */
export type AtlasPage = "S" | "A" | "B";

export interface FaceCell {
  page: AtlasPage;
  /** Where the drawing is, in cells from the plain one: what the shader's `uCell` takes. */
  u: number;
  v: number;
  /** False for the symbols and the closed eyes: a blink only squashes them. */
  blinks: boolean;
}

export const FACES: Readonly<Record<FaceName, FaceCell>> = {
  normal: { page: "S", u: 0, v: 0, blinks: true },
  angry: { page: "S", u: -1, v: 0, blinks: true },
  squint: { page: "S", u: 1, v: 0, blinks: true },
  happy: { page: "S", u: -1, v: -1, blinks: true },
  dead: { page: "S", u: 0, v: -1, blinks: true },
  scan: { page: "S", u: 1, v: -1, blinks: true },
  ecg: { page: "S", u: -1, v: -2, blinks: true },
  sleepy: { page: "S", u: 0, v: -2, blinks: true },
  alert: { page: "S", u: 1, v: -2, blinks: true },
  shocked: { page: "A", u: -1, v: 0, blinks: true },
  confused: { page: "A", u: 0, v: 0, blinks: true },
  thanks: { page: "A", u: 1, v: 0, blinks: false },
  sweat: { page: "A", u: -1, v: -1, blinks: true },
  exclaim: { page: "A", u: 0, v: -1, blinks: false },
  question: { page: "A", u: 1, v: -1, blinks: false },
  sparkle: { page: "A", u: -1, v: -2, blinks: true },
  sad: { page: "A", u: 0, v: -2, blinks: true },
  dizzy: { page: "A", u: 1, v: -2, blinks: true },
  proud: { page: "B", u: -1, v: 0, blinks: true },
  cry: { page: "B", u: 0, v: 0, blinks: false },
  heart: { page: "B", u: 1, v: 0, blinks: true },
  smug: { page: "B", u: -1, v: -1, blinks: true },
  wink: { page: "B", u: 0, v: -1, blinks: true },
  dots: { page: "B", u: 1, v: -1, blinks: false },
  music: { page: "B", u: -1, v: -2, blinks: false },
  determined: { page: "B", u: 0, v: -2, blinks: true },
  laugh: { page: "B", u: 1, v: -2, blinks: false },
};

export const FACE_NAMES: readonly FaceName[] = [...BASE_FACES, ...EXTRA_FACES];

export function isFaceName(name: string): name is FaceName {
  return Object.hasOwn(FACES, name);
}

/** What the body does with a face, each from 0 to 1. `blend` of a face scales it. */
interface Mood {
  /** Fins up and out. */
  happy: number;
  /** Wings opened wide. */
  flare: number;
  /** Fins down and wings low. */
  droop: number;
}

const NONE: Mood = { happy: 0, flare: 0, droop: 0 };

const MOOD_TABLE: Partial<Record<FaceName, Mood>> = {
  happy: { happy: 1, flare: 0, droop: 0 },
  squint: { happy: 0.6, flare: 0.1, droop: 0 },
  thanks: { happy: 1, flare: 0.1, droop: 0 },
  heart: { happy: 1, flare: 0.2, droop: 0 },
  laugh: { happy: 1, flare: 0.3, droop: 0 },
  sparkle: { happy: 0.8, flare: 0.2, droop: 0 },
  proud: { happy: 0.6, flare: 0.1, droop: 0 },
  wink: { happy: 0.7, flare: 0, droop: 0 },
  music: { happy: 0.8, flare: 0.1, droop: 0 },
  smug: { happy: 0.3, flare: 0, droop: 0 },
  determined: { happy: 0.2, flare: 0.3, droop: 0 },
  angry: { happy: 0, flare: 0.35, droop: 0 },
  shocked: { happy: 0, flare: 0.95, droop: 0 },
  alert: { happy: 0, flare: 0.6, droop: 0 },
  exclaim: { happy: 0, flare: 0.7, droop: 0 },
  question: { happy: 0, flare: 0.15, droop: 0 },
  confused: { happy: 0, flare: 0.1, droop: 0.2 },
  sweat: { happy: 0, flare: 0, droop: 0.5 },
  sad: { happy: 0, flare: 0, droop: 1 },
  cry: { happy: 0, flare: 0, droop: 1 },
  sleepy: { happy: 0, flare: 0, droop: 0.6 },
  dead: { happy: 0, flare: 0, droop: 0.8 },
  dizzy: { happy: 0, flare: 0.2, droop: 0.3 },
  dots: { happy: 0, flare: 0, droop: 0.3 },
};

export function moodOf(face: FaceName): Mood {
  return MOOD_TABLE[face] ?? NONE;
}

/** A face is worn once its blend reaches this, and kept until it falls below `LEAVE`. */
export const ENTER_BLEND = 0.5;
export const LEAVE_BLEND = 0.35;
