/**
 * The level of a voice line.
 *
 * The voice lines were recorded far apart (the Japanese ones near -22 LUFS, the other seven languages
 * between -32 and -37). `scripts/library/voicelines/loudness.py` measures each clip and writes a gain
 * `g` in dB into its record, so that every clip reaches the same loudness at the master. The player
 * applies it through `audio.playVoice(url, { gainDb })`.
 *
 * The pipeline assumes the lift of the voice bus below: change it here and in `loudness.py` together.
 */

/** The fixed lift of the voice bus (about +5.6 dB). Voice files are recorded quieter than the music. */
export const VOICE_BUS_GAIN = 1.9;

/** A baked gain outside this range is a corrupt record, not a measurement (the measured range is -10 to +24 dB). */
const MIN_GAIN_DB = -24;
const MAX_GAIN_DB = 30;

/** Decibels to a linear gain. A missing or non finite value is no change. */
export function dbToLinear(db: number | undefined): number {
  if (db === undefined || !Number.isFinite(db)) return 1;
  return 10 ** (Math.min(MAX_GAIN_DB, Math.max(MIN_GAIN_DB, db)) / 20);
}

/** The linear gain of one playback: the caller's `volume` (a factor, default 1) times the baked gain. */
export function voiceLevel(volume: number | undefined, gainDb: number | undefined): number {
  return (volume ?? 1) * dbToLinear(gainDb);
}
