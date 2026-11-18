/**
 * The stage's pixel frame as pure functions, shared by the gramophone and the records. Origin at the
 * middle of the viewport, x right, y up, one unit one CSS pixel at z = 0. The cast pass looks from
 * z = `CAMERA_Z` down the -Z axis, so a thing at depth z is drawn `CAMERA_Z / (CAMERA_Z - z)` times
 * larger than at z = 0.
 */
export const CAMERA_Z = 1000;
/** Nothing is placed nearer the camera than this share of its distance (the scale would run away). */
const NEAR_LIMIT = 0.9;

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a || 1), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Frame rate independent ease of `current` toward `target`. `rate` is 1 / seconds. */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * Math.max(0, dt));
}

/** How much larger a thing at depth `z` is drawn than at z = 0. */
export function depthScale(z: number): number {
  return CAMERA_Z / (CAMERA_Z - Math.min(z, CAMERA_Z * NEAR_LIMIT));
}

/** The scale (stage units per metre) that makes `meters` appear `heightPx` CSS pixels at depth `z`. */
export function scaleForSize(heightPx: number, z: number, meters: number): number {
  return heightPx / depthScale(z) / meters;
}

/** The stage position at depth `z` that is drawn at the screen point (sx, sy). */
export function unprojectToDepth(
  out: { x: number; y: number },
  sx: number,
  sy: number,
  z: number,
): { x: number; y: number } {
  const t = 1 / depthScale(z);
  out.x = sx * t;
  out.y = sy * t;
  return out;
}

/** The screen point of a world point (x, y, z). */
export function project(
  out: { x: number; y: number },
  x: number,
  y: number,
  z: number,
): { x: number; y: number } {
  const s = depthScale(z);
  out.x = x * s;
  out.y = y * s;
  return out;
}

/** The depth of a hit (smaller is nearer to the camera). */
export function hitDepth(z: number): number {
  return CAMERA_Z - z;
}

/** Client pixels (origin top left, y down) to the stage's frame. */
export function clientToStage(
  out: { x: number; y: number },
  clientX: number,
  clientY: number,
  width: number,
  height: number,
): { x: number; y: number } {
  out.x = clientX - width / 2;
  out.y = height / 2 - clientY;
  return out;
}

/** The distance from a point to a segment, and where along it the nearest point is (0 to 1). */
export function segmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  out: { d: number; t: number } = { d: 0, t: 0 },
): { d: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 < 1e-9 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  out.d = Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  out.t = t;
  return out;
}
