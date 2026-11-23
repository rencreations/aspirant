/**
 * A rope and a tail: a verlet chain of points in the stage's pixels (the origin is the middle of the
 * screen, y UP). Pure arithmetic, no three, so the whole fall of a cut rope is tested. The solver
 * runs at a fixed step, so a frame of any length gives the same line.
 */
export interface Chain {
  /** How many points are live. */
  n: number;
  x: Float64Array;
  y: Float64Array;
  px: Float64Array;
  py: Float64Array;
  /** The rest length of one link, in pixels. */
  link: number;
  /** Point 0 is held at this spot (a hand). Null leaves the chain free at that end. */
  pin: { x: number; y: number } | null;
}

/** A point of an array, with a zero for an index that is not there (the arrays are never short). */
const at = (a: Float64Array, i: number): number => a[i] ?? 0;

export function createChain(capacity: number): Chain {
  return {
    n: 0,
    x: new Float64Array(capacity),
    y: new Float64Array(capacity),
    px: new Float64Array(capacity),
    py: new Float64Array(capacity),
    link: 1,
    pin: null,
  };
}

/** Lay `n` points on the straight line from a to b, at rest. The link is the line's length over `n - 1`. */
export function layChain(
  c: Chain,
  n: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): void {
  c.n = Math.min(n, c.x.length);
  for (let i = 0; i < c.n; i += 1) {
    const t = c.n > 1 ? i / (c.n - 1) : 0;
    c.x[i] = c.px[i] = ax + (bx - ax) * t;
    c.y[i] = c.py[i] = ay + (by - ay) * t;
  }
  c.link = c.n > 1 ? Math.hypot(bx - ax, by - ay) / (c.n - 1) : 1;
}

export interface Forces {
  /** Downward pull, in pixels a second squared. */
  gravity: number;
  /** A push on every point, in pixels a second squared. */
  windX: number;
  windY: number;
  /** How quickly the motion dies, per second. */
  damp: number;
  /** A pull on the last point toward a spot, per second squared per pixel (0 for none). */
  tipPull: number;
  tipX: number;
  tipY: number;
  /** A push on the last point, in pixels a second squared (a kite's lift). */
  tipPushX: number;
  tipPushY: number;
  /** The ground: nothing goes under this y (null for none). */
  floor: number | null;
  /** How many times the links are brought back to their length. */
  iterations: number;
}

export function createForces(): Forces {
  return {
    gravity: 900,
    windX: 0,
    windY: 0,
    damp: 1.2,
    tipPull: 0,
    tipX: 0,
    tipY: 0,
    tipPushX: 0,
    tipPushY: 0,
    floor: null,
    iterations: 12,
  };
}

/** One fixed step of `h` seconds. */
export function stepChain(
  c: Chain,
  h: number,
  f: Forces,
  contact?: { index: number; x: number; y: number },
): void {
  const n = c.n;
  if (n === 0) return;
  const { x, y, px, py } = c;
  const keep = Math.exp(-f.damp * h);
  const first = c.pin ? 1 : 0;
  const held = contact?.index ?? -1;
  if (contact) {
    x[held] = px[held] = contact.x;
    y[held] = py[held] = contact.y;
  }
  if (c.pin) {
    x[0] = px[0] = c.pin.x;
    y[0] = py[0] = c.pin.y;
  }
  for (let i = first; i < n; i += 1) {
    if (i === held) continue;
    const cx = at(x, i);
    const cy = at(y, i);
    const vx = (cx - at(px, i)) * keep;
    const vy = (cy - at(py, i)) * keep;
    px[i] = cx;
    py[i] = cy;
    let ax = f.windX;
    let ay = f.windY - f.gravity;
    if (i === n - 1) {
      ax += f.tipPushX;
      ay += f.tipPushY;
      if (f.tipPull > 0) {
        ax += f.tipPull * (f.tipX - cx);
        ay += f.tipPull * (f.tipY - cy);
      }
    }
    x[i] = cx + vx + ax * h * h;
    y[i] = cy + vy + ay * h * h;
  }
  for (let it = 0; it < f.iterations; it += 1) {
    for (let i = 0; i < n - 1; i += 1) {
      const ax = at(x, i);
      const ay = at(y, i);
      const bx = at(x, i + 1);
      const by = at(y, i + 1);
      const dx = bx - ax;
      const dy = by - ay;
      const d = Math.hypot(dx, dy) || 1e-6;
      const diff = (d - c.link) / d;
      const lockedA = (i === 0 && c.pin !== null) || i === held;
      const lockedB = i + 1 === held;
      const wa = lockedA ? 0 : lockedB ? 1 : 0.5;
      const wb = lockedB ? 0 : lockedA ? 1 : 0.5;
      x[i] = ax + dx * diff * wa;
      y[i] = ay + dy * diff * wa;
      x[i + 1] = bx - dx * diff * wb;
      y[i + 1] = by - dy * diff * wb;
    }
    if (c.pin) {
      x[0] = c.pin.x;
      y[0] = c.pin.y;
    }
    if (f.floor !== null) {
      for (let i = first; i < n; i += 1) {
        if (at(y, i) < f.floor) {
          y[i] = f.floor;
          // Lying on the ground it does not slide far.
          px[i] = at(x, i) - (at(x, i) - at(px, i)) * 0.5;
          py[i] = f.floor;
        }
      }
    }
  }
}

/** The length of the line through the points, in pixels. */
export function chainLength(c: Chain): number {
  let sum = 0;
  for (let i = 0; i < c.n - 1; i += 1) {
    sum += Math.hypot(at(c.x, i + 1) - at(c.x, i), at(c.y, i + 1) - at(c.y, i));
  }
  return sum;
}

/**
 * A smooth line through the points of a chain (Catmull-Rom), `sub` pieces for each link, written
 * as pairs into `out` (x, y, x, y, ...). Returns how many points were written.
 */
export function smoothChain(c: Chain, sub: number, out: Float32Array): number {
  const n = c.n;
  if (n < 2) return 0;
  let w = 0;
  const clampIndex = (i: number) => Math.min(n - 1, Math.max(0, i));
  for (let i = 0; i < n - 1; i += 1) {
    const i0 = clampIndex(i - 1);
    const i2 = i + 1;
    const i3 = clampIndex(i + 2);
    const steps = i === n - 2 ? sub + 1 : sub;
    const x0 = at(c.x, i0);
    const x1 = at(c.x, i);
    const x2 = at(c.x, i2);
    const x3 = at(c.x, i3);
    const y0 = at(c.y, i0);
    const y1 = at(c.y, i);
    const y2 = at(c.y, i2);
    const y3 = at(c.y, i3);
    for (let s = 0; s < steps; s += 1) {
      const t = s / sub;
      const t2 = t * t;
      const t3 = t2 * t;
      out[w * 2] =
        0.5 *
        (2 * x1 +
          (-x0 + x2) * t +
          (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 +
          (-x0 + 3 * x1 - 3 * x2 + x3) * t3);
      out[w * 2 + 1] =
        0.5 *
        (2 * y1 +
          (-y0 + y2) * t +
          (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 +
          (-y0 + 3 * y1 - 3 * y2 + y3) * t3);
      w += 1;
    }
  }
  return w;
}

/**
 * Cut a chain after point `k`: the lower part keeps points 0..k and the upper part gets k+1..n-1.
 * Both keep their positions and their speeds. The upper part has no pin.
 */
export function cutChain(c: Chain, k: number, lower: Chain, upper: Chain): void {
  const cut = Math.max(0, Math.min(c.n - 2, k));
  lower.n = cut + 1;
  upper.n = c.n - cut - 1;
  lower.link = c.link;
  upper.link = c.link;
  lower.pin = c.pin;
  upper.pin = null;
  for (let i = 0; i <= cut; i += 1) {
    lower.x[i] = at(c.x, i);
    lower.y[i] = at(c.y, i);
    lower.px[i] = at(c.px, i);
    lower.py[i] = at(c.py, i);
  }
  for (let i = 0; i < upper.n; i += 1) {
    upper.x[i] = at(c.x, cut + 1 + i);
    upper.y[i] = at(c.y, cut + 1 + i);
    upper.px[i] = at(c.px, cut + 1 + i);
    upper.py[i] = at(c.py, cut + 1 + i);
  }
}

/**
 * The nearest point on the line through a chain to (x, y): `at` is how far along it, 0 at the first
 * point to 1 at the last, and `dist` the distance in pixels. False for a chain with no link.
 */
export function nearestOnChain(
  c: Chain,
  x: number,
  y: number,
  out: { at: number; dist: number },
): boolean {
  if (c.n < 2) return false;
  let best = Infinity;
  let bestAt = 0;
  for (let i = 0; i < c.n - 1; i += 1) {
    const ax = at(c.x, i);
    const ay = at(c.y, i);
    const dx = at(c.x, i + 1) - ax;
    const dy = at(c.y, i + 1) - ay;
    const len2 = dx * dx + dy * dy || 1e-9;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / len2));
    const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
    if (d < best) {
      best = d;
      bestAt = (i + t) / (c.n - 1);
    }
  }
  out.at = bestAt;
  out.dist = best;
  return true;
}
