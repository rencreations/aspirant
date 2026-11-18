/**
 * Plain maths for the picture field: easing, the quintic Hermite, quaternions and small vectors.
 * Nothing here knows three.js, so every function is tested in plain vitest. Quaternions are
 * `[x, y, z, w]`. Functions that take an `out` write into it and return it (the frame loop
 * allocates nothing).
 */

export type Q = [number, number, number, number];
export type V3 = [number, number, number];

export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;

export const clamp = (x: number, a = 0, b = 1): number => (x < a ? a : x > b ? b : x);
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 0 to 1 over [a, b], clamped. */
export const ramp = (x: number, a: number, b: number): number => clamp((x - a) / (b - a));

/** x^3 (6x^2 - 15x + 10): zero first and second derivative at both ends. */
export function smootherstep(x: number): number {
  const t = clamp(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** x^4 (35 - 84x + 70x^2 - 20x^3): zero derivatives up to the third at both ends. */
export function smoothest(x: number): number {
  const t = clamp(x);
  return t * t * t * t * (35 - 84 * t + 70 * t * t - 20 * t * t * t);
}

/**
 * The quintic Hermite from `p0` (velocity `v0`, acceleration `a0`) to `p1` (velocity `v1`,
 * acceleration `a1`) at `t` in [0, 1]. Velocities and accelerations are per unit of t.
 */
export function hermite5(
  p0: number,
  v0: number,
  a0: number,
  p1: number,
  v1: number,
  a1: number,
  t: number,
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;
  const h0 = 1 - 10 * t3 + 15 * t4 - 6 * t5;
  const h1 = t - 6 * t3 + 8 * t4 - 3 * t5;
  const h2 = 0.5 * t2 - 1.5 * t3 + 1.5 * t4 - 0.5 * t5;
  const h3 = 10 * t3 - 15 * t4 + 6 * t5;
  const h4 = -4 * t3 + 7 * t4 - 3 * t5;
  const h5 = 0.5 * t3 - t4 + 0.5 * t5;
  return h0 * p0 + h1 * v0 + h2 * a0 + h3 * p1 + h4 * v1 + h5 * a1;
}

/** A small seeded random generator (mulberry32). The scatter must be the same on every load. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Euler angles in the order X, then Y, then Z (three's "XYZ"), in radians. */
export function qFromEuler(x: number, y: number, z: number, out: Q): Q {
  const c1 = Math.cos(x / 2);
  const c2 = Math.cos(y / 2);
  const c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2);
  const s2 = Math.sin(y / 2);
  const s3 = Math.sin(z / 2);
  out[0] = s1 * c2 * c3 + c1 * s2 * s3;
  out[1] = c1 * s2 * c3 - s1 * c2 * s3;
  out[2] = c1 * c2 * s3 + s1 * s2 * c3;
  out[3] = c1 * c2 * c3 - s1 * s2 * s3;
  return out;
}

/** `a` then `b` (the product b * a: apply `a` first). Safe when `out` is `a` or `b`. */
export function qMul(b: Q, a: Q, out: Q): Q {
  const bx = b[0];
  const by = b[1];
  const bz = b[2];
  const bw = b[3];
  const ax = a[0];
  const ay = a[1];
  const az = a[2];
  const aw = a[3];
  out[0] = bw * ax + bx * aw + by * az - bz * ay;
  out[1] = bw * ay - bx * az + by * aw + bz * ax;
  out[2] = bw * az + bx * ay - by * ax + bz * aw;
  out[3] = bw * aw - bx * ax - by * ay - bz * az;
  return out;
}

/** The shortest-path spherical interpolation. Safe when `out` is `a` or `b`. */
export function qSlerp(a: Q, b: Q, t: number, out: Q): Q {
  const ax = a[0];
  const ay = a[1];
  const az = a[2];
  const aw = a[3];
  let bx = b[0];
  let by = b[1];
  let bz = b[2];
  let bw = b[3];
  let cos = ax * bx + ay * by + az * bz + aw * bw;
  if (cos < 0) {
    cos = -cos;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  let s0 = 1 - t;
  let s1 = t;
  if (cos < 0.9995) {
    const omega = Math.acos(cos);
    const sin = Math.sin(omega);
    s0 = Math.sin((1 - t) * omega) / sin;
    s1 = Math.sin(t * omega) / sin;
  }
  out[0] = s0 * ax + s1 * bx;
  out[1] = s0 * ay + s1 * by;
  out[2] = s0 * az + s1 * bz;
  out[3] = s0 * aw + s1 * bw;
  const n = Math.hypot(out[0], out[1], out[2], out[3]) || 1;
  out[0] /= n;
  out[1] /= n;
  out[2] /= n;
  out[3] /= n;
  return out;
}

/** The rotation whose columns are the three axes (right, up, normal), each a unit vector. */
export function qFromBasis(xAxis: V3, yAxis: V3, zAxis: V3, out: Q): Q {
  const m11 = xAxis[0];
  const m21 = xAxis[1];
  const m31 = xAxis[2];
  const m12 = yAxis[0];
  const m22 = yAxis[1];
  const m32 = yAxis[2];
  const m13 = zAxis[0];
  const m23 = zAxis[1];
  const m33 = zAxis[2];
  const trace = m11 + m22 + m33;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    out[3] = 0.25 / s;
    out[0] = (m32 - m23) * s;
    out[1] = (m13 - m31) * s;
    out[2] = (m21 - m12) * s;
  } else if (m11 > m22 && m11 > m33) {
    const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
    out[3] = (m32 - m23) / s;
    out[0] = 0.25 * s;
    out[1] = (m12 + m21) / s;
    out[2] = (m13 + m31) / s;
  } else if (m22 > m33) {
    const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
    out[3] = (m13 - m31) / s;
    out[0] = (m12 + m21) / s;
    out[1] = 0.25 * s;
    out[2] = (m23 + m32) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
    out[3] = (m21 - m12) / s;
    out[0] = (m13 + m31) / s;
    out[1] = (m23 + m32) / s;
    out[2] = 0.25 * s;
  }
  return out;
}

/** Rotate a vector by a unit quaternion. Safe when `out` is `v`. */
export function qRotate(q: Q, vx: number, vy: number, vz: number, out: V3): V3 {
  const x = q[0];
  const y = q[1];
  const z = q[2];
  const w = q[3];
  // t = 2 * cross(q.xyz, v); v' = v + w * t + cross(q.xyz, t)
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  out[0] = vx + w * tx + (y * tz - z * ty);
  out[1] = vy + w * ty + (z * tx - x * tz);
  out[2] = vz + w * tz + (x * ty - y * tx);
  return out;
}

/** The camera model of the pixel frame: a point `z` toward the camera, seen from `d` away. */
export function perspectiveScale(z: number, d: number): number {
  return d / (d - z);
}
