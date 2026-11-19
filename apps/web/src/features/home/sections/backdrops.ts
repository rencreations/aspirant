/**
 * The live backdrop of the first four sections (round two, 19 Nov 2026), as one pure function of the
 * story position `S` (`story.ts`). The hero, the aspirants, the rows and the strip run in step and
 * all ask the same question, so whichever of them runs last in a frame says the same thing, and a
 * kind that changes does so at one story position whatever the order. The backdrop cross-fades
 * when the kind changes (0.5 s on the clock), so a station is never a hard cut.
 *
 *   S 0 to 5.3     none: the hero and the wall (the owner's words on the right) stand on the plain daybreak ground
 *   S 5.3 to 7.7   silk, daybreak, low: a quiet cloth under the rows;
 *                  the rows fade it out with the ground as the transition runs (`rows/ground.ts`)
 *   S 7.7 on       ink field, storm: the strip's own dark ground (a flowing luminous mist that answers
 *                  the cursor, `fx/backdrop/glsl-ink.ts`), from where the rows' transition ends through
 *                  the window and the orbit of the ten films.
 */
import type { BackdropKind, BackdropOptions } from "../fx/backdrop";

import { silkShare } from "./rows/ground";
import { STORY } from "./story";

export interface BackdropSpec {
  readonly kind: BackdropKind;
  readonly options: BackdropOptions;
}

const SILK: BackdropSpec = { kind: "silk", options: { theme: "daybreak", amount: 0.5 } };
/** The silk while the rows' transition fades it out with the ground (round three): one object, its amount written in place. */
const SILK_FADING: BackdropSpec = {
  kind: "silk",
  options: { theme: "daybreak", amount: SILK.options.amount ?? 0.5 },
};
const SILK_AMOUNT = SILK.options.amount ?? 0.5;
const INK: BackdropSpec = { kind: "ink-field", options: { theme: "storm", amount: 0.9 } };

/** Where each backdrop begins on the story axis, in order. */
/** The ink field comes in where the rows' transition ends (the ground is already dark and the silk is gone): no flash. */
/** The silk begins with the rows: the wall (the hero's landing, the owner's words, the clip opening) has no backdrop behind it (the owner, 20 Nov 2026). */
export const BACKDROP_AT = {
  silk: STORY.rows.start,
  ink: STORY.rows.start + STORY.rows.length,
} as const;

/** Every kind this range uses, for `warm` (compile the shaders before the first frame). */
export const BACKDROP_KINDS_USED: readonly BackdropKind[] = [SILK.kind, INK.kind];

/**
 * The backdrop at a story position, or null for none. The hero (S before `BACKDROP_AT.silk`) has no
 * backdrop: its ground is the plain daybreak off white with its dots (the owner, 20 Nov 2026). The
 * objects are made once: nothing is allocated per frame.
 */
export function backdropAt(S: number): BackdropSpec | null {
  if (S < BACKDROP_AT.silk) return null;
  if (S < BACKDROP_AT.ink) {
    // From the start of the rows' transition the silk goes out with the paper: no light cloth over the dark ground.
    const share = S > STORY.rows.start ? silkShare(S - STORY.rows.start) : 1;
    if (share >= 1) return SILK;
    SILK_FADING.options.amount = SILK_AMOUNT * share;
    return SILK_FADING;
  }
  return INK;
}
