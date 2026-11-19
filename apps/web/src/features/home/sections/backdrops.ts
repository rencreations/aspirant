/**
 * The live backdrop of the first four sections (round two, 19 Nov 2026), as one pure function of the
 * story position `S` (`story.ts`). The hero, the aspirants, the rows and the strip run in step and
 * all ask the same question, so whichever of them runs last in a frame says the same thing, and a
 * kind that changes does so at one story position whatever the order. The backdrop cross-fades
 * when the kind changes (0.5 s on the clock), so a station is never a hard cut.
 *
 *   S 0 to 5.3     none: the hero and the wall (the owner's words on the right) stand on the plain daybreak ground
 *   S 5.3 to 7.7   silk, daybreak, low: a quiet cloth under the rows;
 *                  the rows fade it out as the transition runs (`rows/ground.ts`)
 *   S 7.7 on       ink field, daybreak: the strip's own mist (a very soft, slowly flowing pastel on the
 *                  paper that leans a little toward the cursor, `fx/backdrop/glsl-ink.ts`), from where
 *                  the rows' transition ends through the window and the orbit of the ten films. It
 *                  comes in over about four seconds of real time (`stepInkEntrance`).
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
/**
 * The strip's mist on the light ground (round five: light only). `amount` is written in place: it is
 * the entrance's, 0 when the strip has just arrived and `INK_LEVEL` after `INK_ENTRANCE_S` seconds.
 * The descent that follows has no backdrop of its own: the mist is gone with the strip (round six).
 */
export const INK_LEVEL = 0.9;
export const INK_INTENSITY = 1.7;
const INK: BackdropSpec = {
  kind: "ink-field",
  options: { theme: "daybreak", amount: 0, intensity: INK_INTENSITY },
};

/** Seconds of real time the mist takes to come in once the strip has arrived (not tied to the scroll). */
export const INK_ENTRANCE_S = 4;

/** The entrance's curve: 0 to 1 over `INK_ENTRANCE_S`, starting so gently that nobody sees it begin. */
export function inkEntrance(seconds: number): number {
  const t = Math.min(1, Math.max(0, seconds / INK_ENTRANCE_S));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** The entrance's clock, in seconds since the strip arrived. Written by `stepInkEntrance` only. */
let inkClock = 0;

/**
 * One frame of the entrance. The strip calls it once a frame with the frame's `dt` (a frozen frame
 * holds it): the mist's amount rises on its own clock while the strip is on, and falls back quickly
 * when the strip is left (so it comes in again, slowly, on the next arrival). A long frame is cut to a
 * tenth of a second, so a sleeping tab does not skip the entrance.
 */
export function stepInkEntrance(dt: number, on: boolean): void {
  const step = Math.min(Math.max(dt, 0), 0.1);
  inkClock = on ? Math.min(INK_ENTRANCE_S, inkClock + step) : Math.max(0, inkClock - 4 * step);
  INK.options.amount = INK_LEVEL * inkEntrance(inkClock);
}

/** The strip was left upward: the next arrival brings the mist in again, from nothing. */
export function resetInkEntrance(): void {
  inkClock = 0;
  INK.options.amount = 0;
}

/** Where each backdrop begins on the story axis, in order. */
/** The ink field comes in where the rows' transition ends (the silk is gone by then): no flash. */
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
    // From the start of the rows' transition the silk goes out, ahead of the strip's own backdrop.
    const share = S > STORY.rows.start ? silkShare(S - STORY.rows.start) : 1;
    if (share >= 1) return SILK;
    SILK_FADING.options.amount = SILK_AMOUNT * share;
    return SILK_FADING;
  }
  return INK;
}
