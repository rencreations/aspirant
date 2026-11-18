/**
 * The colours of the marks. The comic style is flat colour with a thick ink outline: ink, pink,
 * gold and white, with a pale sky for water. A fill is bright on purpose: the ink outline carries
 * it on the daybreak ground and the fill carries it on the storm ground. Values are sRGB, written
 * to the screen as they are (no tone mapping, no colour space conversion in the shader).
 */
export type MarkColor = "ink" | "pink" | "gold" | "white" | "sky" | "bone" | number;

const NAMED: Readonly<Record<Exclude<MarkColor, number>, number>> = {
  ink: 0x0b0d12,
  pink: 0xff2d7a,
  gold: 0xffc14a,
  white: 0xffffff,
  sky: 0x9fdcff,
  bone: 0xf3f5f9,
};

/** Write a colour as three 0 to 1 floats into `out` at `at`. */
export function writeColor(color: MarkColor, out: Float32Array | number[], at: number): void {
  const hex = typeof color === "number" ? color : NAMED[color];
  out[at] = ((hex >> 16) & 255) / 255;
  out[at + 1] = ((hex >> 8) & 255) / 255;
  out[at + 2] = (hex & 255) / 255;
}

/** The colour as one hex number (tests and the lab read it). */
export function colorHex(color: MarkColor): number {
  return typeof color === "number" ? color : NAMED[color];
}
