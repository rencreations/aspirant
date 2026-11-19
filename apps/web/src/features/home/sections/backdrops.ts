/**
 * The live backdrop of the first four sections (round two, 19 Nov 2026), as one pure function of the
 * story position `S` (`story.ts`). The hero, the aspirants, the rows and the strip run in step and
 * all ask the same question, so whichever of them runs last in a frame says the same thing, and a
 * kind that changes does so at one story position whatever the order. The backdrop cross-fades
 * when the kind changes (0.5 s on the clock), so a station is never a hard cut.
 *
 *   S 0 to 3.3     soft aurora, pastel, daybreak: pools of colour under the logo and the cards
 *   S 3.3 to 5.7   silk, daybreak, low: a quiet cloth under the wall, the owner's words and the rows
 *   S 5.7 on       ink field, storm: the strip's own dark ground (a flowing luminous mist that answers
 *                  the cursor, `fx/backdrop/glsl-ink.ts`), from inside the rows' transition through the
 *                  window and the orbit of the ten films. The strip's runtime adds the film's glow.
 */
import type { BackdropKind, BackdropOptions } from "../fx/backdrop";

export interface BackdropSpec {
  readonly kind: BackdropKind;
  readonly options: BackdropOptions;
}

const SOFT: BackdropSpec = { kind: "soft-aurora", options: { theme: "daybreak", amount: 0.9 } };
const SILK: BackdropSpec = { kind: "silk", options: { theme: "daybreak", amount: 0.5 } };
const INK: BackdropSpec = { kind: "ink-field", options: { theme: "storm", amount: 0.9 } };

/** Where each backdrop begins on the story axis, in order. */
/** The ink field comes in inside the rows' transition (0.4 screens in: the space is opening), not with the wall's close. */
export const BACKDROP_AT = { silk: 3.3, ink: 5.7 } as const;

/** Every kind this range uses, for `warm` (compile the shaders before the first frame). */
export const BACKDROP_KINDS_USED: readonly BackdropKind[] = [SOFT.kind, SILK.kind, INK.kind];

/** The backdrop at a story position. The objects are made once: nothing is allocated per frame. */
export function backdropAt(S: number): BackdropSpec {
  if (S < BACKDROP_AT.silk) return SOFT;
  if (S < BACKDROP_AT.ink) return SILK;
  return INK;
}
