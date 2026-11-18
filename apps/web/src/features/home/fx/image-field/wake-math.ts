/**
 * The arithmetic of the wake, the small velocity field the cursor stirs (digest 1.6). Pure
 * numbers: the three.js part is `wake.ts`.
 */

/** The long side of the field, in texels. */
export const WAKE_LONG = 160;
/** The field stays live this long after the last stir (7 decays of 0.35 s). */
export const WAKE_LIVE_S = 2.45;
/** A pointer slower than this (px/s) does not stir. */
export const STIR_MIN = 12;
/** The stir force is capped at this speed (px/s). */
export const STIR_CAP = 1700;

/** The size of the field for a viewport: the long side is `WAKE_LONG` and the aspect is kept. */
export function wakeSize(w: number, h: number): { w: number; h: number } {
  const k = WAKE_LONG / Math.max(1, w, h);
  return { w: Math.max(8, Math.round(w * k)), h: Math.max(8, Math.round(h * k)) };
}

/** The pointer's velocity, low-passed as premotio does (0.35 of the way each frame at 60 Hz). */
export function smoothVelocity(previous: number, raw: number, dt: number): number {
  const rate = 25.8;
  return previous + (raw - previous) * (1 - Math.exp(-rate * Math.max(0, dt)));
}

/** The force to stir with, in px/s: the velocity, never past `STIR_CAP` of speed. Returns the speed. */
export function stirForce(vx: number, vy: number, out: [number, number]): number {
  const speed = Math.hypot(vx, vy);
  const k = speed > STIR_CAP ? STIR_CAP / speed : 1;
  out[0] = vx * k;
  out[1] = vy * k;
  return speed;
}

/** The radius of the brush, in CSS pixels. */
export function stirRadius(w: number, h: number): number {
  return 0.05 * Math.min(w, h);
}

/** True while the field has something in it to move and to draw. */
export function wakeIsLive(secondsSinceStir: number): boolean {
  return secondsSinceStir < WAKE_LIVE_S;
}
