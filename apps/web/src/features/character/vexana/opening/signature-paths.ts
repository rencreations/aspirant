/**
 * The signature, サナ, in one flowing hand: サ in three strokes and ナ in two, then a long swash
 * underneath. Drawn in a 760 x 400 box and slanted a little on screen. The order is the order
 * of the strokes, so it writes the way a hand would (bar, tick, long stroke; bar, long stroke).
 */
export interface SignatureStroke {
  d: string;
  /** Pen width in box units. */
  width: number;
  /** Rough length, so a longer stroke takes longer. */
  length: number;
}

export const SIGNATURE_BOX = { w: 760, h: 400 } as const;

export const SIGNATURE: readonly SignatureStroke[] = [
  // サ: the bar, the short tick, the long stroke that sweeps left.
  { d: "M58 168 C128 154 214 146 338 130", width: 10, length: 290 },
  { d: "M142 64 C150 104 154 160 148 224", width: 10, length: 170 },
  { d: "M258 30 C266 108 270 196 252 262 C240 306 196 336 128 352", width: 12, length: 420 },
  // ナ: the bar, the long falling stroke through it.
  { d: "M388 170 C468 154 566 146 700 132", width: 10, length: 320 },
  { d: "M548 44 C534 138 492 252 400 330 C384 344 372 346 358 340", width: 12, length: 380 },
  // The swash: under both, ending in a flick.
  { d: "M96 372 C230 392 440 392 604 350 C690 328 726 300 704 284", width: 7, length: 640 },
];
