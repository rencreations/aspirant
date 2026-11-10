/**
 * The drawn line of the Music room: the sound of a track wrapped once around its disc, like the
 * trace of a needle. Its swing follows the loudness of the track (`wave` in the data, made by
 * `scripts/library/music/discs.py`), so every disc has its own line: quiet intros are almost flat,
 * the choruses swing wide. The pen starts at the top and runs clockwise, so a playing track draws
 * its line as it goes.
 *
 * Plain math here; the engine turns it into a ribbon mesh and only moves uniforms (how much is
 * drawn, which part has played), never the geometry.
 */

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

export const TRACE = {
  /** Points around the loop. */
  points: 2048,
  /** Swings of the line around the loop (waves that never line up, so it is not a pattern). */
  cycles: 70,
  cycles2: 113,
  /** The share of the second wave. */
  mix: 0.26,
  /** The radius of the middle of the line, the disc's rim being 1. */
  radius: 1.085,
  /** The widest swing, in disc radii. */
  amplitude: 0.065,
  /** Even silence keeps a little swing, so the line reads as a line and not a gap. */
  floor: 0.05,
  /** Thickness of the line, in disc radii. */
  width: 0.0065,
} as const;

/** The loudness steps of a track, 0 to 1. An empty or broken string gives an even half. */
export function parseWave(text: string | null | undefined): Float32Array {
  const clean = (text ?? "").toLowerCase();
  if (!clean) return new Float32Array([0.5, 0.5]);
  const out = new Float32Array(clean.length);
  for (let i = 0; i < clean.length; i += 1) {
    const v = DIGITS.indexOf(clean[i] ?? "0");
    out[i] = v < 0 ? 0.5 : v / (DIGITS.length - 1);
  }
  return out.length === 1 ? new Float32Array([out[0] ?? 0.5, out[0] ?? 0.5]) : out;
}

/** The loudness at `u` (0 to 1 along the track), between two steps. */
export function levelAt(wave: Float32Array, u: number): number {
  const n = wave.length;
  if (n === 0) return 0.5;
  const x = Math.min(Math.max(u, 0), 1) * (n - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = wave[i] ?? 0;
  const b = wave[Math.min(n - 1, i + 1)] ?? a;
  return a + (b - a) * f;
}

/** A smooth irregular value, 0 to 1, the same for the same `x` (value noise, eased steps). */
function smoothNoise(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const hash = (n: number) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const t = f * f * (3 - 2 * f);
  return hash(i) * (1 - t) + hash(i + 1) * t;
}

/**
 * The swing of the line at `u`, -1 to 1 (times `TRACE.amplitude` in the shader). Waves that never
 * line up, each swing a little taller or shorter than the last, under the loudness of the track:
 * it reads as sound, not as a pattern. It is 0 at both ends, so the loop closes at the top.
 */
export function swingAt(wave: Float32Array, u: number): number {
  const level = TRACE.floor + (1 - TRACE.floor) * levelAt(wave, u);
  const tau = Math.PI * 2;
  const wobble =
    0.58 * Math.sin(tau * TRACE.cycles * u) +
    TRACE.mix * Math.sin(tau * TRACE.cycles2 * u + 1.7) +
    0.16 * Math.sin(tau * 29 * u + 0.4);
  const grain = 0.55 + 0.45 * smoothNoise(u * 260);
  const ends = Math.min(1, u * 40, (1 - u) * 40);
  return level * wobble * grain * ends;
}

/**
 * The swing at every point of the loop, and its slope (change per unit of `u`), which the shader
 * needs to keep the line the same thickness on its steep parts.
 */
export function traceSamples(
  wave: Float32Array,
  points: number = TRACE.points,
): { u: Float32Array; swing: Float32Array; slope: Float32Array } {
  const u = new Float32Array(points + 1);
  const swing = new Float32Array(points + 1);
  const slope = new Float32Array(points + 1);
  for (let i = 0; i <= points; i += 1) {
    const t = i / points;
    u[i] = t;
    swing[i] = swingAt(wave, t);
  }
  for (let i = 0; i <= points; i += 1) {
    const a = swing[Math.max(0, i - 1)] ?? 0;
    const b = swing[Math.min(points, i + 1)] ?? 0;
    const span = (Math.min(points, i + 1) - Math.max(0, i - 1)) / points;
    slope[i] = span > 0 ? (b - a) / span : 0;
  }
  return { u, swing, slope };
}

/**
 * The point of the line at `u`, in the plane of the disc (x right, y up), as the shader places
 * it: the pen starts at the top and goes clockwise.
 */
export function tracePoint(wave: Float32Array, u: number): { x: number; y: number } {
  const angle = Math.PI / 2 - u * Math.PI * 2;
  const r = TRACE.radius + TRACE.amplitude * swingAt(wave, u);
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}
