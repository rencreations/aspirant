/**
 * How the doll is drawn: the three looks of her three parts (`parts.ts`) on the shared toon system
 * (`actors/shared/toon.ts`), the share of the ink line her hair gets, and the light trim of a dark
 * section. These are the numbers to tune by eye.
 */
import type { TOON_LOOKS, ToonLookSpec } from "../shared/toon";

import { PART, type PartKind } from "./parts";

/** A part's starting look and its overrides. */
export interface PartLook {
  look: keyof typeof TOON_LOOKS;
  tune: Partial<ToonLookSpec>;
}

export const PART_LOOKS: Readonly<Record<PartKind, PartLook>> = {
  [PART.cloth]: { look: "default", tune: {} },
  [PART.skin]: { look: "skin", tune: { rim: 0.22 } },
  [PART.hair]: { look: "hair", tune: { glint: 0.6, glintSize: 0.972 } },
};

/**
 * The line round her, as a multiple of the toon system's width for her size: a drawing is a little
 * bolder than the models, but a figure under 100 px tall keeps the system's width (more would fill
 * her with ink) and one over 400 px gets the whole boost.
 */
export const INK_BOOST = 1.4;

export function inkBoost(heightPx: number): number {
  const t = Math.min(1, Math.max(0, (heightPx - 100) / 300));
  return 1 + (INK_BOOST - 1) * t;
}

/** How steep a surface the ink may cross before it paints over its neighbour: the depth push, in multiples of the line's width. */
export const INK_SLOPE = 7;

/**
 * A look under a section's light trim: `direct` (1 is the plain look) scales the lit colour, and
 * `ambient` the shade (a lower ambient is a deeper shade). Both stay near 1: this is a trim for a
 * dark section, not a lighting rig.
 */
export function trimLook(base: ToonLookSpec, direct: number, ambient: number): ToonLookSpec {
  const scale = (c: readonly [number, number, number], k: number): [number, number, number] => [
    c[0] * k,
    c[1] * k,
    c[2] * k,
  ];
  return {
    ...base,
    lit: scale(base.lit, direct),
    shade: scale(base.shade, ambient),
    deep: scale(base.deep, ambient),
  };
}
