/**
 * The numbers of the records and the crate. Everything here is built in code (no model file), in
 * metres, to the scale of the gramophone's platter (`gramophone/facts.ts`: a record of radius 0.14
 * on a platter of radius 0.1415), so a disc fits the platter at a local scale of 1.
 */
export const RECORDS_NAME = "records";

/** The crate holds at most this many sleeves (the loading list reads no more covers). */
export const MAX_SLEEVES = 12;

export const DISC = {
  radius: 0.14,
  thickness: 0.004,
  /** The paper label that carries the cover. */
  labelRadius: 0.045,
  /** The spindle's hole (the gramophone's spindle stands 4.6 mm above a 4 mm record). */
  hole: 0.006,
  /** The distance between two grooves, for the shader. */
  groovePitch: 0.0016,
} as const;

export const SLEEVE = {
  /** A square sleeve, a little bigger than the disc. */
  size: 0.3,
  thickness: 0.007,
} as const;
