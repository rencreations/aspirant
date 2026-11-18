/**
 * The doll's faces over the whole carry, as one time line in screens from the hand's start (the
 * sequencer of the doll actor plays it: `DollActor.mood(FACES, t)`).
 */
import type { FaceName } from "../../actors/doll/face/presets";
import type { MoodStep } from "../../actors/doll/face/sequence";

import { HAND_AT, HAND_SCREENS, LIST_AT } from "./timeline";

interface Timed {
  face: FaceName;
  /** The moment the face is fully shown, in screens from the hand's start. */
  at: number;
  blend: number;
}

/** Turn "this face by then" into the steps the doll's sequencer plays. */
export function faceSteps(list: readonly Timed[]): MoodStep[] {
  return list.map((f, i) => {
    const next = list[i + 1];
    const hold = next ? Math.max(0.01, next.at - next.blend - f.at) : 99;
    return i === 0
      ? { face: f.face, hold: Math.max(0.01, hold) }
      : { face: f.face, hold, blend: f.blend };
  });
}

/** One time line of faces for the whole carry. The first step is shown from t = 0. */
export const FACES: readonly MoodStep[] = faceSteps([
  { face: "gloom", at: 0, blend: 0 },
  { face: "scared", at: 0.35, blend: 0.3 },
  { face: "shocked", at: HAND_AT.land + 0.04, blend: 0.04 },
  { face: "dizzy", at: HAND_AT.land + 0.2, blend: 0.08 },
  { face: "smile", at: HAND_SCREENS - 1.0, blend: 0.3 },
  { face: "grin", at: HAND_SCREENS + LIST_AT.toss[0] + 0.05, blend: 0.1 },
  { face: "smile", at: HAND_SCREENS + LIST_AT.toss[1] + 0.2, blend: 0.2 },
  { face: "worried", at: HAND_SCREENS + LIST_AT.expandFrom + 0.2, blend: 0.18 },
  { face: "determined", at: HAND_SCREENS + LIST_AT.expandFrom + 0.7, blend: 0.2 },
]);
