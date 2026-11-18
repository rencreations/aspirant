/**
 * Quaternion and vector helpers that work on flat arrays and allocate nothing, so the pose, the
 * hair solver and the gaze can run every frame without garbage. A quaternion is (x, y, z, w). Every
 * function reads from an array at an offset and writes to an array at an offset; the output may be
 * the same array and offset as an input.
 */
export type Floats = Float32Array | number[];

/** out = a * b (apply b first, then a). */
export function qmul(a: Floats, ia: number, b: Floats, ib: number, out: Floats, io: number): void {
  const ax = a[ia]!;
  const ay = a[ia + 1]!;
  const az = a[ia + 2]!;
  const aw = a[ia + 3]!;
  const bx = b[ib]!;
  const by = b[ib + 1]!;
  const bz = b[ib + 2]!;
  const bw = b[ib + 3]!;
  out[io] = aw * bx + ax * bw + ay * bz - az * by;
  out[io + 1] = aw * by - ax * bz + ay * bw + az * bx;
  out[io + 2] = aw * bz + ax * by - ay * bx + az * bw;
  out[io + 3] = aw * bw - ax * bx - ay * by - az * bz;
}

/** out = the inverse of the unit quaternion `a`. */
export function qconj(a: Floats, ia: number, out: Floats, io: number): void {
  const x = a[ia]!;
  const y = a[ia + 1]!;
  const z = a[ia + 2]!;
  const w = a[ia + 3]!;
  out[io] = -x;
  out[io + 1] = -y;
  out[io + 2] = -z;
  out[io + 3] = w;
}

/** The quaternion of a turn by `angle` radians about the unit axis (ax, ay, az). */
export function qaxis(
  ax: number,
  ay: number,
  az: number,
  angle: number,
  out: Floats,
  io: number,
): void {
  const h = angle * 0.5;
  const s = Math.sin(h);
  out[io] = ax * s;
  out[io + 1] = ay * s;
  out[io + 2] = az * s;
  out[io + 3] = Math.cos(h);
}

/** Rotate the vector (x, y, z) by the quaternion q. */
export function qrotate(
  q: Floats,
  iq: number,
  x: number,
  y: number,
  z: number,
  out: Floats,
  io: number,
): void {
  const qx = q[iq]!;
  const qy = q[iq + 1]!;
  const qz = q[iq + 2]!;
  const qw = q[iq + 3]!;
  // t = 2 * (q.xyz x v); v' = v + w * t + q.xyz x t
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  out[io] = x + qw * tx + (qy * tz - qz * ty);
  out[io + 1] = y + qw * ty + (qz * tx - qx * tz);
  out[io + 2] = z + qw * tz + (qx * ty - qy * tx);
}

/** The shortest turn that takes the unit vector u to the unit vector v. */
export function qfromTo(
  ux: number,
  uy: number,
  uz: number,
  vx: number,
  vy: number,
  vz: number,
  out: Floats,
  io: number,
): void {
  const d = ux * vx + uy * vy + uz * vz;
  if (d > 0.999999) {
    out[io] = 0;
    out[io + 1] = 0;
    out[io + 2] = 0;
    out[io + 3] = 1;
    return;
  }
  if (d < -0.999999) {
    // Opposite: turn half a circle about any axis across u.
    let ax = -uy;
    let ay = ux;
    let az = 0;
    if (Math.abs(ux) > 0.9) {
      ax = 0;
      ay = -uz;
      az = uy;
    }
    const n = 1 / Math.hypot(ax, ay, az);
    out[io] = ax * n;
    out[io + 1] = ay * n;
    out[io + 2] = az * n;
    out[io + 3] = 0;
    return;
  }
  const cx = uy * vz - uz * vy;
  const cy = uz * vx - ux * vz;
  const cz = ux * vy - uy * vx;
  const w = 1 + d;
  const n = 1 / Math.hypot(cx, cy, cz, w);
  out[io] = cx * n;
  out[io + 1] = cy * n;
  out[io + 2] = cz * n;
  out[io + 3] = w * n;
}

/** The angle of a unit quaternion, 0 to pi. */
export function qangle(q: Floats, iq: number): number {
  const w = Math.min(1, Math.abs(q[iq + 3]!));
  return 2 * Math.acos(w);
}

/** Scale the turn of a unit quaternion toward the identity: factor 1 keeps it, 0 gives no turn. */
export function qscale(q: Floats, iq: number, factor: number, out: Floats, io: number): void {
  const x = q[iq]!;
  const y = q[iq + 1]!;
  const z = q[iq + 2]!;
  let w = q[iq + 3]!;
  const sign = w < 0 ? -1 : 1;
  w *= sign;
  const half = Math.acos(Math.min(1, w));
  const s = Math.sin(half);
  if (s < 1e-6) {
    out[io] = 0;
    out[io + 1] = 0;
    out[io + 2] = 0;
    out[io + 3] = 1;
    return;
  }
  const k = (Math.sin(half * factor) / s) * sign;
  out[io] = x * k;
  out[io + 1] = y * k;
  out[io + 2] = z * k;
  out[io + 3] = Math.cos(half * factor);
}

export function qidentity(out: Floats, io: number): void {
  out[io] = 0;
  out[io + 1] = 0;
  out[io + 2] = 0;
  out[io + 3] = 1;
}
