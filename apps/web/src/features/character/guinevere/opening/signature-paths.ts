/**
 * The signature: a capital G in one flowing hand. The body of the letter is one round stroke that
 * starts at the upper right, goes over the top and down the left, round the bottom and up the right;
 * the bar is a quick stroke back through the middle; then a long swash runs out under the letter and
 * curls into a loop at the right, and a short thin flick crosses it. Drawn in a 760 x 420 box and
 * slanted a little on screen. The order is the order of the strokes, so it writes the way a hand
 * would. Every stroke is a centre line with a pressure profile: `signature-outline.ts` turns it
 * into a tapered shape, light at the start, full in the middle and thin at the flick, the way a
 * pen presses.
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
  // The body of the G: in at the upper right with a small hook, over the top, down the left side,
  // round the bottom and up the right.
  {
    d: "M612 118 C586 64 536 30 458 22 C340 10 220 58 168 150 C118 238 150 336 232 372 C330 414 468 380 534 288 C560 252 566 220 552 196",
    width: 17,
    press: [0.25, 0.8, 1, 1, 0.9, 0.7, 0.4],
    length: 1040,
  },
  // The bar: from the right, back through the middle of the letter.
  {
    d: "M606 204 C540 214 452 220 360 214",
    width: 11,
    press: [0.5, 1, 0.9, 0.2],
    length: 260,
    speed: 1.3,
  },
  // The swash: out from under the letter, long and low, ending in a loop at the right.
  {
    d: "M96 392 C230 420 470 424 640 352 C714 320 742 276 716 256 C696 242 674 262 692 282",
    width: 8,
    press: [0.2, 0.8, 1, 0.9, 0.6, 0.25],
    length: 720,
  },
  // The flick: thin and quick, back across the swash.
  {
    d: "M700 404 C560 414 330 416 190 402",
    width: 4,
    press: [0.2, 1, 0.8, 0.1],
    length: 520,
    speed: 2.4,
  },
];

/** Four-pointed sparkles that pop at the end of the signature: where, how big, how late (s). */
export const SPARKS: ReadonlyArray<{ x: number; y: number; size: number; delay: number }> = [
  { x: 640, y: 96, size: 22, delay: 0 },
  { x: 90, y: 330, size: 14, delay: 0.12 },
  { x: 730, y: 236, size: 16, delay: 0.22 },
  { x: 380, y: 372, size: 12, delay: 0.3 },
];
