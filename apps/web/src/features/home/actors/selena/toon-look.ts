/**
 * Selena's look, matched to the in-game recordings (`D:\ren\aspirant\media\_others\in-game-animation\selena`,
 * notes in `docs/design/home/round7-SEL-render.md`). What the recordings show: a hairline in the
 * colour of what it outlines (warm on the hair, rose on the skin, deep on the armour), a face lit
 * almost flat with a soft pink shade, warm orange hair with a pale sheen, white armour with a light
 * lavender shade, and black armour that shades smoothly. The numbers are tuned by eye against frames
 * of the recording at the same size (`D:\ren\aspirant-work\home\SEL-render\`).
 */
import type { ToonLookSpec } from "../shared/toon-math";

/** Overrides of the shared looks, one per part. */
export const SELENA_TUNE = {
  /** The face: nearly flat. A wide soft edge, the shade only far from the light, no rim. */
  head: {
    soft: 0.22,
    cut: [-0.25, -0.12],
    shade: [0.98, 0.83, 0.87],
    deep: [0.88, 0.66, 0.74],
    sat: 1.1,
    rim: 0.08,
    rimWidth: 0.2,
  },
  /** The hair: the shade is a deeper orange, not a violet one; a small pale sheen. */
  hair: {
    soft: 0.09,
    cut: [-0.45, 0.08],
    shade: [0.96, 0.74, 0.6],
    deep: [0.86, 0.62, 0.52],
    lit: [1, 0.95, 0.86],
    sat: 1.25,
    rim: 0.12,
    rimWidth: 0.2,
    glint: 0.2,
  },
  /** The armour and cloth: a light lavender shade, a soft band, a faint rim (no white outline). */
  body: {
    soft: 0.15,
    cut: [-0.25, 0.0],
    shade: [0.76, 0.78, 0.94],
    deep: [0.55, 0.58, 0.86],
    sat: 1.12,
    rim: 0.14,
    rimWidth: 0.2,
  },
} as const satisfies Record<string, Partial<ToonLookSpec>>;

/** How much of a place that looks at the viewer keeps its line: none inside the face, all on its outline. */
export const FACE_LINE: readonly [number, number] = [0.12, 0.42];

/** The darkest a line may be (linear): the texels at the edge of a lock of hair are black, a line of black on gold is not the recording's. */
export const INK_FLOORS = {
  hair: [0.1, 0.045, 0.04],
  skin: [0.1, 0.04, 0.04],
} as const;

/** The fringe's line is this many shifted copies of its cards (six for the cast's thicker line). */
export const FRINGE_COPIES = 4;
