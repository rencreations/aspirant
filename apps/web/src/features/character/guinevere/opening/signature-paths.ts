import { GLYPH_BOX } from "./signature-glyph.generated";

/**
 * The signature is a fancy written G (the owner's drawing, traced into `signature-glyph.generated.ts`
 * by `scripts/guinevere/signature.py`). The letter itself is one filled shape; what is animated is
 * the pen: a few wide strokes along the rough centre lines of the letter, in the order a hand writes
 * it, that uncover the shape as they are drawn. A glowing tip rides at the end of each.
 */
export interface SignatureStroke {
  /** The centre line: one `M`, then `Q` and `L` segments, in the box of the glyph. */
  d: string;
  /** Width of the uncovering stroke in box units (a little wider than the ink). */
  width: number;
  /** Rough length, so a longer stroke takes longer. */
  length: number;
  /** A quick stroke is written faster than its length says. */
  speed?: number;
}

export const SIGNATURE_BOX = GLYPH_BOX;

export const SIGNATURE: readonly SignatureStroke[] = [
  // The hook and the upper loop, ending on the tip where the long stroke starts.
  {
    d: "M460.5 0.8Q329.0 14.0 282.0 40.3Q235.1 66.6 216.3 105.1Q197.5 143.6 216.3 180.2Q235.1 216.8 272.7 228.1Q310.2 239.4 347.8 241.3Q385.4 243.1 441.7 230.9Q498.1 218.7 563.8 190.5Q629.6 162.4 676.5 134.2Q723.5 106.0 738.5 82.5Q753.6 59.0 733.8 41.2Q714.1 23.3 671.8 31.8Q629.6 40.3 573.2 73.1Q516.9 106.0 460.5 148.3Q404.2 190.5 366.6 228.1Q329.0 265.7 313.0 298.6Q297.1 331.4 308.3 359.6Q319.6 387.8 352.5 397.2Q385.4 406.6 427.6 387.8Q469.9 369.0 507.5 331.4Q545.0 293.9 581.7 271.3L618.3 248.8",
    width: 62,
    length: 1989,
  },
  // The long stem down to the lower left, round the big loop at the bottom and back up.
  {
    d: "M610.8 254.4Q535.6 340.8 498.1 392.5Q460.5 444.1 422.9 491.1Q385.4 538.1 343.1 585.0Q300.8 632.0 258.6 667.2Q216.3 702.4 169.3 728.3Q122.4 754.1 80.1 744.7Q37.8 735.3 21.4 697.7Q5.0 660.2 21.4 620.3Q37.8 580.3 80.1 545.1Q122.4 509.9 174.0 488.8Q225.7 467.6 277.4 460.6Q329.0 453.5 355.3 467.6Q381.6 481.7 390.1 519.3Q398.5 556.9 382.5 596.8Q366.6 636.7 333.7 664.9Q300.8 693.0 268.0 701.0L235.1 709.0",
    width: 62,
    length: 1664,
  },
  // The small curl inside the loop.
  {
    d: "M182.5 556.9Q158.1 599.1 159.9 624.9Q161.8 650.8 175.0 669.6Q188.1 688.3 202.2 692.1L216.3 695.9",
    width: 44,
    length: 176,
    speed: 0.7,
  },
];

/** Four-pointed sparkles that pop at the end of the signature: where, how big, how late (s). */
export const SPARKS: ReadonlyArray<{ x: number; y: number; size: number; delay: number }> = [
  { x: 748, y: 24, size: 24, delay: 0 },
  { x: 60, y: 520, size: 15, delay: 0.12 },
  { x: 650, y: 330, size: 16, delay: 0.22 },
  { x: 120, y: 760, size: 13, delay: 0.3 },
];
