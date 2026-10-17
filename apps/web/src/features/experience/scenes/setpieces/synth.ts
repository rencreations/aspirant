import { audio } from "@/lib/audio";

/**
 * Small Web Audio helpers for the set pieces. Everything goes through the site's master bus,
 * so the global mute and compressor apply. All calls are silent no-ops until the visitor has
 * entered and audio is unlocked; call `wake()` from inside a click, tap or key handler.
 */

/** Unlock audio from a user gesture (safe to call every time). */
export function wake(): void {
  if (!audio.unlocked) audio.unlock();
}

export interface NoteOptions {
  /** Seconds. Default 1.2. */
  dur?: number;
  /** Peak gain. Default 0.06 (keep it low: it sits under the story and voice). */
  gain?: number;
  type?: OscillatorType;
  /** Delay in seconds. */
  delay?: number;
}

/** A soft bell-like note. Returns false when audio is not available. */
export function note(
  freq: number,
  { dur = 1.2, gain = 0.06, type = "sine", delay = 0 }: NoteOptions = {},
) {
  const s = audio.getSynthOut();
  if (!s) return false;
  const { ctx, out } = s;
  const t = ctx.currentTime + 0.01 + delay;
  for (const [ratio, g, d] of [
    [1, gain, dur],
    [2.01, gain * 0.25, dur * 0.5],
    [3.98, gain * 0.08, dur * 0.3],
  ] as const) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq * ratio;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(g, t + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + d + 0.05);
    osc.onended = () => env.disconnect();
  }
  return true;
}

/** Major pentatonic scale from a root (C4 by default): index 0, 1, 2 ... climbs. */
export function pentatonic(index: number, root = 261.63): number {
  const steps = [0, 2, 4, 7, 9];
  const octave = Math.floor(index / steps.length);
  const step = steps[((index % steps.length) + steps.length) % steps.length] ?? 0;
  return root * 2 ** (octave + step / 12);
}

/**
 * A sustained tone you can retune and fade (for hums). Returns null without audio.
 * Remember to call `stop()` when the piece goes off screen or unmounts.
 */
export function hum(freq: number, gain = 0.035) {
  const s = audio.getSynthOut();
  if (!s) return null;
  const { ctx, out } = s;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  env.gain.value = 0;
  env.gain.setTargetAtTime(gain, ctx.currentTime, 0.2);
  osc.connect(env).connect(out);
  osc.start();
  return {
    set(nextFreq: number, nextGain = gain) {
      osc.frequency.setTargetAtTime(nextFreq, ctx.currentTime, 0.05);
      env.gain.setTargetAtTime(nextGain, ctx.currentTime, 0.1);
    },
    stop() {
      env.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      osc.stop(ctx.currentTime + 0.8);
      osc.onended = () => env.disconnect();
    },
  };
}
