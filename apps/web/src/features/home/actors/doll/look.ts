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
  // Cloth and gloves: flat, one cool shade.
  [PART.cloth]: {
    look: "default",
    tune: { rim: 0.3, rimWidth: 0.2, soft: 0.03, cut: [-0.25, -0.02] },
  },
  // Skin and the face: lit almost everywhere (the normals lean to the viewer), a thin warm shade, no pale rim.
  [PART.skin]: { look: "skin", tune: { rim: 0.1, rimWidth: 0.2, soft: 0.03, cut: [-0.25, -0.12] } },
  // Hair: two flat tones, one hard terminator, the highlight is the arc of `flat.ts` (no glint).
  [PART.hair]: {
    look: "hair",
    tune: { bands: 2, glint: 0, rim: 0.3, rimWidth: 0.2, soft: 0.012, cut: [-0.2, 0.28] },
  },
};

/** The numbers of `flat.ts`: the shading normals, the steps of the picture and the hair's highlight arc. */
export interface FlatSpec {
  /** The centre of the ball the hair and the face are shaded as, in the model's file units (1.7 tall). */
  head: readonly [number, number, number];
  /** The direction the face, the neck and (a little) the rest lean to: toward the viewer and up. */
  front: readonly [number, number, number];
  /** How far the face's normals are pulled to `front` (1 is flat), the share of the hair's own normal kept, and the neck's pull. */
  faceFront: number;
  hairOwn: number;
  neckFront: number;
  /** Steps of the picture's lightness, by `PART` (cloth, skin, hair). */
  levels: readonly [number, number, number];
  /** The highlight arc: the axis (view space), the cosines it spans, how white it is and how strong. */
  ringAxis: readonly [number, number, number];
  ringFrom: number;
  ringTo: number;
  ringWhite: number;
  ringAmount: number;
}

export const FLAT: FlatSpec = {
  head: [0, 0.98, -0.12],
  front: [0, 0.28, 1],
  faceFront: 0.72,
  hairOwn: 0.15,
  neckFront: 0.8,
  levels: [0, 0, 0],
  ringAxis: [-0.5, 0.75, 0.43],
  ringFrom: 0.825,
  ringTo: 0.855,
  ringWhite: 0.45,
  ringAmount: 0.85,
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
