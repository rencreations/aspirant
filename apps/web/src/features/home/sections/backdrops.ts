/**
 * The live backdrop of the first four sections (round two, 19 Nov 2026), as one pure function of the
 * story position `S` (`story.ts`). The hero, the aspirants, the rows and the strip run in step and
 * all ask the same question, so whichever of them runs last in a frame says the same thing, and a
 * kind that changes does so at one story position whatever the order. The backdrop cross-fades
 * when the kind changes (0.5 s on the clock), so a station is never a hard cut.
 *
 *   S 0 to 3.3     soft aurora, pastel, daybreak: pools of colour under the logo and the cards
 *   S 3.3 to 4.95  silk, daybreak, low: a quiet cloth under the wall and the owner's words
 *   S 4.95 to 9.3  beams, storm: soft diagonal beams under the rows, the film and the window
 *   S 9.3 on       threads, storm: hairlines that gather and part around the orbit of the ten films
 */
import type { BackdropKind, BackdropOptions } from "../fx/backdrop";

export interface BackdropSpec {
  readonly kind: BackdropKind;
  readonly options: BackdropOptions;
}

const SOFT: BackdropSpec = { kind: "soft-aurora", options: { theme: "daybreak", amount: 0.9 } };
const SILK: BackdropSpec = { kind: "silk", options: { theme: "daybreak", amount: 0.5 } };
const BEAMS: BackdropSpec = { kind: "beams", options: { theme: "storm", amount: 0.75 } };
const THREADS: BackdropSpec = { kind: "threads", options: { theme: "storm", amount: 0.4 } };

/** Where each backdrop begins on the story axis, in order. */
export const BACKDROP_AT = { silk: 3.3, beams: 4.95, threads: 9.3 } as const;

/** Every kind this range uses, for `warm` (compile the shaders before the first frame). */
export const BACKDROP_KINDS_USED: readonly BackdropKind[] = [
  SOFT.kind,
  SILK.kind,
  BEAMS.kind,
  THREADS.kind,
];

/** The backdrop at a story position. The objects are made once: nothing is allocated per frame. */
export function backdropAt(S: number): BackdropSpec {
  if (S < BACKDROP_AT.silk) return SOFT;
  if (S < BACKDROP_AT.beams) return SILK;
  if (S < BACKDROP_AT.threads) return BEAMS;
  return THREADS;
}
