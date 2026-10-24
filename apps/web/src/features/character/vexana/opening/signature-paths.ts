/**
 * The signature, サナ, in one flowing hand: サ in three strokes and ナ in two, a long swash under
 * both and a fast thin flourish back across it. Drawn in a 760 x 420 box and slanted a little on
 * screen. The order is the order of the strokes, so it writes the way a hand would (bar, tick,
 * long stroke; bar, long stroke; swash; flourish). Every stroke is a centre line with a pressure
 * profile: `signature-outline.ts` turns it into a tapered shape, light at the start, full in the
 * middle and thin at the flick, the way a pen presses.
 */
export interface SignatureStroke {
  /** The centre line: one `M` and cubic `C` segments. */
  d: string;
  /** Pen width in box units at full pressure. */
  width: number;
  /** Pressure along the stroke, evenly spaced, 0 to 1. */
  press: readonly number[];
  /** Rough length, so a longer stroke takes longer. */
  length: number;
  /** A quick stroke is written faster than its length says. */
  speed?: number;
}

export const SIGNATURE_BOX = { w: 760, h: 420 } as const;

export const SIGNATURE: readonly SignatureStroke[] = [
  // サ: the bar, rising, the short tick, the long stroke that sweeps left and curls.
  {
    d: "M44 186 C120 162 230 148 348 122",
    width: 13,
    press: [0.3, 0.9, 1, 0.55, 0.15],
    length: 320,
  },
  { d: "M146 50 C160 100 162 170 146 234", width: 13, press: [0.5, 1, 0.9, 0.4], length: 190 },
  {
    d: "M262 16 C274 104 276 200 256 270 C242 318 190 350 98 362 C70 366 50 358 60 346",
    width: 15,
    press: [0.45, 1, 1, 0.8, 0.45, 0.2],
    length: 470,
  },
  // ナ: the bar, rising, then the long falling stroke through it, ending in a curl.
  {
    d: "M392 178 C476 158 580 146 724 118",
    width: 13,
    press: [0.3, 0.9, 1, 0.5, 0.12],
    length: 350,
  },
  {
    d: "M556 28 C542 138 496 262 396 338 C372 356 348 352 354 336",
    width: 15,
    press: [0.4, 1, 1, 0.7, 0.25],
    length: 420,
  },
  // The swash: under both, ending in a flick that loops.
  {
    d: "M70 386 C220 412 450 410 628 362 C712 338 742 298 716 278 C700 266 676 282 690 298",
    width: 9,
    press: [0.2, 0.8, 1, 0.9, 0.6, 0.25],
    length: 700,
  },
  // The flourish: thin, quick, back across the swash.
  {
    d: "M708 392 C560 404 300 406 150 396",
    width: 4.5,
    press: [0.2, 1, 0.8, 0.1],
    length: 560,
    speed: 2.4,
  },
];

/** Four-pointed sparkles that pop at the end of the signature: where, how big, how late (s). */
export const SPARKS: ReadonlyArray<{ x: number; y: number; size: number; delay: number }> = [
  { x: 724, y: 268, size: 22, delay: 0 },
  { x: 80, y: 342, size: 15, delay: 0.12 },
  { x: 366, y: 330, size: 13, delay: 0.22 },
  { x: 568, y: 22, size: 17, delay: 0.3 },
];
